import type { Entity } from "@atlasjs/nexus";
import { createLogger, Logger } from "@atlasjs/utils";

import { decodeServer, encodeClient } from "../net/codec";
import { PROTOCOL_VERSION } from "../net/protocol";
import type {
  ClientMessage,
  NetId,
  PlayerInfo,
  ServerMessage,
} from "../net/protocol";
import { SnapshotBuffer } from "../net/SnapshotBuffer";

import { NetEventQueue } from "./NetEventQueue";

/* Entity creation is handed out rather than owned: what a replicated player looks like needs
   sprites, audio clips and a palette, none of which is a networking concern. */
export type NetPlayerFactory = {
  create: (info: PlayerInfo) => Entity;
  destroy: (entity: Entity) => void;
};

export type NetworkClientOptions = {
  url: string;
  factory: NetPlayerFactory;
  now: () => number;
  name?: string;
};

export class NetworkClient {
  public readonly buffer: SnapshotBuffer;
  public readonly events: NetEventQueue;

  private readonly logger: Logger;
  private readonly options: NetworkClientOptions;
  private readonly entities: Map<NetId, Entity>;

  private socket: WebSocket | null;
  private self: NetId | null;

  public constructor(options: NetworkClientOptions) {
    this.logger = createLogger("BumpRoyalClient");
    this.options = options;
    this.buffer = new SnapshotBuffer();
    this.events = new NetEventQueue();
    this.entities = new Map<NetId, Entity>();
    this.socket = null;
    this.self = null;
  }

  public get localId(): NetId | null {
    return this.self;
  }

  public get playerCount(): number {
    return this.entities.size;
  }

  public connect(): void {
    const socket: WebSocket = new WebSocket(this.options.url);
    this.socket = socket;

    socket.addEventListener("open", (): void => this.onOpen());

    socket.addEventListener("message", (event: MessageEvent): void =>
      this.onMessage(event),
    );

    socket.addEventListener("close", (event: CloseEvent): void => {
      this.logger.log(`disconnected (${event.code})`);
    });

    socket.addEventListener("error", (): void => {
      this.logger.error(`socket error on ${this.options.url}`);
    });
  }

  public send(message: ClientMessage): void {
    const socket: WebSocket | null = this.socket;

    if (socket === null || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(encodeClient(message));
  }

  public ack(): number {
    return this.buffer.newest()?.t ?? 0;
  }

  /* The queue is emptied and not replayed: resync jumps the render clock forward onto the newest
     snapshot, so everything still pending would come due in the same frame — a burst of squishes
     and one overlapping sound per bump the tab missed while it was hidden. */
  public resync(now: number): void {
    this.buffer.resync(now);
    this.events.clear();
  }

  public close(): void {
    const socket: WebSocket | null = this.socket;
    this.socket = null;
    socket?.close();

    for (const entity of this.entities.values()) {
      this.options.factory.destroy(entity);
    }

    this.entities.clear();
    this.buffer.clear();
    this.events.clear();
    this.self = null;
  }

  private onOpen(): void {
    this.send(
      this.options.name === undefined
        ? { k: "hello", v: PROTOCOL_VERSION }
        : { k: "hello", v: PROTOCOL_VERSION, name: this.options.name },
    );
  }

  private onMessage(event: MessageEvent): void {
    if (typeof event.data !== "string") {
      return;
    }

    const message: ServerMessage | null = decodeServer(event.data);

    if (message === null) {
      this.logger.warn("dropped an undecodable server message");
      return;
    }

    switch (message.k) {
      case "welcome":
        this.self = message.you;
        this.buffer.anchor(message.tick, this.options.now());

        for (const info of message.players) {
          this.spawn(info);
        }

        this.logger.log(`joined as ${message.you} at tick ${message.tick}`);
        return;

      case "join":
        this.spawn(message.player);
        return;

      case "leave":
        this.despawn(message.id);
        return;

      case "snap":
        /* Only on a snapshot the buffer accepted: a duplicate would otherwise queue its events
           a second time, and the client would squish twice for one bump. */
        if (
          this.buffer.push(message, this.options.now()) &&
          message.e !== undefined
        ) {
          this.events.push(message.e);
        }

        return;
    }
  }

  /* A snapshot naming an unknown id is ignored by the applier rather than spawning anything:
     WebSocket ordering guarantees a join precedes every snapshot mentioning a player, so an
     unknown id can only be a straggler that a leave has already retired. */
  private spawn(info: PlayerInfo): void {
    if (this.entities.has(info.id)) {
      return;
    }

    this.entities.set(info.id, this.options.factory.create(info));
  }

  private despawn(id: NetId): void {
    const entity: Entity | undefined = this.entities.get(id);

    if (entity === undefined) {
      return;
    }

    this.entities.delete(id);
    this.options.factory.destroy(entity);
  }
}
