import WebSocket from "ws";
import type { RawData } from "ws";

import { decodeServer, encodeClient } from "../../src/net/codec";
import { INPUT_REDUNDANCY, PROTOCOL_VERSION } from "../../src/net/protocol";
import type {
  ClientMessage,
  InputFrame,
  ServerMessage,
  ServerSnapshot,
} from "../../src/net/protocol";

const DEFAULT_TIMEOUT_MS: number = 10000;
const CLIENT_FRAME_MS: number = 1000 / 60;

export type Received = {
  readonly message: ServerMessage;
  readonly at: number;
};

export type Axis = -1 | 0 | 1;

export type PumpOptions = {
  frames: number;
  x: Axis;
  y: Axis;
};

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve, ms);
  });
}

/* A real `ws` client rather than a fake: the point of these specs is that the wire, the codec
   and the engine loop agree, and a stub of any of the three would assume the answer. */
export class TestClient {
  public readonly received: Received[];

  private readonly socket: WebSocket;
  private readonly waiters: Set<() => void>;
  private clientTick: number;

  private constructor(socket: WebSocket) {
    this.socket = socket;
    this.received = [];
    this.waiters = new Set<() => void>();
    this.clientTick = 0;

    socket.on("message", (data: RawData): void => {
      const message: ServerMessage | null = decodeServer(data.toString());

      if (message !== null) {
        this.received.push({ message, at: performance.now() });
      }

      for (const notify of [...this.waiters]) {
        notify();
      }
    });
  }

  public static connect(port: number, name?: string): Promise<TestClient> {
    const socket: WebSocket = new WebSocket(`ws://127.0.0.1:${port}`);
    const client: TestClient = new TestClient(socket);

    return new Promise<TestClient>(
      (
        resolve: (value: TestClient) => void,
        reject: (error: Error) => void,
      ): void => {
        socket.once("error", reject);
        socket.once("open", (): void => {
          client.send(
            name === undefined
              ? { k: "hello", v: PROTOCOL_VERSION }
              : { k: "hello", v: PROTOCOL_VERSION, name },
          );
          resolve(client);
        });
      },
    );
  }

  public send(message: ClientMessage): void {
    this.socket.send(encodeClient(message));
  }

  public sendRedundant(frame: InputFrame): void {
    for (let copy: number = 0; copy < INPUT_REDUNDANCY; copy++) {
      this.send({ k: "input", f: [frame], a: 0 });
    }
  }

  /* Mirrors the client loop the protocol assumes: one message per client frame, each carrying
     the last INPUT_REDUNDANCY frames, so every frame reaches the server three times. */
  public async pump(options: PumpOptions): Promise<void> {
    for (let i: number = 0; i < options.frames; i++) {
      const window: InputFrame[] = [];

      for (
        let back: number = Math.min(INPUT_REDUNDANCY - 1, this.clientTick);
        back >= 0;
        back--
      ) {
        window.push({
          t: this.clientTick - back,
          x: options.x,
          y: options.y,
          d: false,
        });
      }

      this.send({ k: "input", f: window, a: 0 });
      this.clientTick++;

      await sleep(CLIENT_FRAME_MS);
    }
  }

  public messages<K extends ServerMessage["k"]>(
    kind: K,
  ): Extract<ServerMessage, { k: K }>[] {
    return this.received
      .map((entry: Received): ServerMessage => entry.message)
      .filter(
        (message: ServerMessage): message is Extract<ServerMessage, { k: K }> =>
          message.k === kind,
      );
  }

  public snapshots(): ServerSnapshot[] {
    return this.messages("snap");
  }

  public snapshotTimes(): number[] {
    return this.received
      .filter((entry: Received): boolean => entry.message.k === "snap")
      .map((entry: Received): number => entry.at);
  }

  public lastSnapshot(): ServerSnapshot {
    const all: ServerSnapshot[] = this.snapshots();

    if (all.length === 0) {
      throw new Error("no snapshot received yet");
    }

    return all[all.length - 1];
  }

  public waitUntil(
    predicate: () => boolean,
    label: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<void> {
    if (predicate()) {
      return Promise.resolve();
    }

    return new Promise<void>(
      (resolve: () => void, reject: (error: Error) => void): void => {
        const timer: ReturnType<typeof setTimeout> = setTimeout((): void => {
          this.waiters.delete(check);
          reject(new Error(`timed out waiting for ${label}`));
        }, timeoutMs);

        const check = (): void => {
          if (!predicate()) {
            return;
          }

          clearTimeout(timer);
          this.waiters.delete(check);
          resolve();
        };

        this.waiters.add(check);
      },
    );
  }

  public close(): Promise<void> {
    this.waiters.clear();

    if (this.socket.readyState === WebSocket.CLOSED) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve: () => void): void => {
      this.socket.once("close", (): void => resolve());
      this.socket.close();
    });
  }
}
