import { createLogger, Logger } from "@atlasjs/utils";
import { WebSocket, WebSocketServer } from "ws";
import type { RawData } from "ws";

import { decodeClient, encodeServer } from "../net/codec";
import {
  PROTOCOL_VERSION,
  SNAPSHOT_INTERVAL_TICKS,
  TICK_HZ,
} from "../net/protocol";
import type {
  ClientMessage,
  NetId,
  ServerMessage,
  ServerSnapshot,
} from "../net/protocol";

import type { GameRoom, RoomPlayer } from "./GameRoom";
import type { InputInbox } from "./InputInbox";

/* The codec bounds array lengths but reads whatever string the socket hands it, so the frame
   size has to be bounded here. The largest legal client message is a hello carrying a
   MAX_NAME_LENGTH name; 4 KiB is orders of magnitude above that and still a hard stop. */
export const MAX_PAYLOAD_BYTES: number = 4096;

export const CLOSE_PROTOCOL_ERROR: number = 1002;
export const CLOSE_ROOM_FULL: number = 1013;

type Client = {
  readonly socket: WebSocket;
  id: NetId | null;
};

export type WebSocketTransportOptions = {
  port: number;
  host?: string;
  room: GameRoom;
  inbox: InputInbox;
  currentTick: () => number;
};

export class WebSocketTransport {
  private readonly logger: Logger;
  private readonly options: WebSocketTransportOptions;
  private readonly clients: Map<WebSocket, Client>;
  private readonly sockets: Map<NetId, WebSocket>;

  private server: WebSocketServer | null;
  private closing: boolean;

  public constructor(options: WebSocketTransportOptions) {
    this.logger = createLogger("BumpRoyalTransport");
    this.options = options;
    this.clients = new Map<WebSocket, Client>();
    this.sockets = new Map<NetId, WebSocket>();
    this.server = null;
    this.closing = false;
  }

  public start(): Promise<number> {
    const server: WebSocketServer = new WebSocketServer({
      port: this.options.port,
      host: this.options.host,
      maxPayload: MAX_PAYLOAD_BYTES,
    });

    this.server = server;

    server.on("connection", (socket: WebSocket): void =>
      this.onConnection(socket),
    );

    return new Promise<number>(
      (
        resolve: (port: number) => void,
        reject: (error: Error) => void,
      ): void => {
        server.once("error", reject);
        server.once("listening", (): void => {
          server.off("error", reject);
          server.on("error", (error: Error): void => {
            this.logger.error(`server error: ${error.message}`);
          });
          resolve(this.boundPort());
        });
      },
    );
  }

  public recipients(): readonly NetId[] {
    return [...this.sockets.keys()];
  }

  public send(id: NetId, snapshot: ServerSnapshot): void {
    const socket: WebSocket | undefined = this.sockets.get(id);

    if (socket !== undefined) {
      this.write(socket, snapshot);
    }
  }

  public close(): Promise<void> {
    const server: WebSocketServer | null = this.server;
    this.server = null;
    this.closing = true;

    for (const socket of this.clients.keys()) {
      socket.terminate();
    }

    this.clients.clear();
    this.sockets.clear();

    if (server === null) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve: () => void): void => {
      server.close((): void => resolve());
    });
  }

  private boundPort(): number {
    const address: string | { port: number } | null =
      this.server?.address() ?? null;

    if (address === null || typeof address === "string") {
      throw new Error("WebSocketTransport: server is not bound to a TCP port.");
    }

    return address.port;
  }

  private onConnection(socket: WebSocket): void {
    const client: Client = { socket, id: null };
    this.clients.set(socket, client);

    socket.on("message", (data: RawData): void =>
      this.onMessage(client, data.toString()),
    );

    socket.on("close", (): void => this.onClose(client));

    socket.on("error", (error: Error): void => {
      this.logger.error(`socket error: ${error.message}`);
      socket.terminate();
    });
  }

  /* decodeHello gates on PROTOCOL_VERSION, so a client speaking another version fails to
     decode exactly like a malformed frame does — and both end the same way, with the socket
     closed. There is nothing useful to say to a peer that cannot parse the reply. */
  private onMessage(client: Client, raw: string): void {
    const message: ClientMessage | null = decodeClient(raw);

    if (message === null) {
      client.socket.close(CLOSE_PROTOCOL_ERROR, "protocol");
      return;
    }

    if (message.k === "hello") {
      this.onHello(client, message.name);
      return;
    }

    if (client.id === null) {
      client.socket.close(CLOSE_PROTOCOL_ERROR, "protocol");
      return;
    }

    this.options.inbox.add(client.id, message.f);
  }

  private onHello(client: Client, name: string | undefined): void {
    if (client.id !== null) {
      client.socket.close(CLOSE_PROTOCOL_ERROR, "protocol");
      return;
    }

    const player: RoomPlayer | null = this.options.room.join(name);

    if (player === null) {
      client.socket.close(CLOSE_ROOM_FULL, "full");
      return;
    }

    client.id = player.id;
    this.sockets.set(player.id, client.socket);

    const tick: number = this.options.currentTick();

    this.write(client.socket, {
      k: "welcome",
      v: PROTOCOL_VERSION,
      you: player.id,
      tick,
      hz: TICK_HZ,
      snapEvery: SNAPSHOT_INTERVAL_TICKS,
      players: this.options.room.roster(),
    });

    this.broadcast({ k: "join", tick, player: player.info }, player.id);
    this.logger.log(`player ${player.id} joined (${this.options.room.size})`);
  }

  /* terminate() emits "close" asynchronously, so this can still fire after the engine has been
     stopped and the world destroyed. Once the transport is closing a socket ending is shutdown
     noise, not a player leaving, and touching the room there would throw on a dead entity. */
  private onClose(client: Client): void {
    this.clients.delete(client.socket);

    const id: NetId | null = client.id;
    client.id = null;

    if (id === null || this.closing) {
      return;
    }

    this.sockets.delete(id);
    this.options.inbox.forget(id);

    const left: RoomPlayer | null = this.options.room.leave(id);

    if (left === null) {
      return;
    }

    this.broadcast({ k: "leave", tick: this.options.currentTick(), id }, id);
    this.logger.log(`player ${id} left (${this.options.room.size})`);
  }

  private broadcast(message: ServerMessage, except: NetId): void {
    for (const [id, socket] of this.sockets) {
      if (id !== except) {
        this.write(socket, message);
      }
    }
  }

  private write(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(encodeServer(message));
    }
  }
}
