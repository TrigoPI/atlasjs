import { LogTransport } from "./LogTransport";
import { WebSocketClient } from "./WebSocketClient";
import { LogLevel, WebSocketTransportPayload } from "./types";

export class WebSocketTransport implements LogTransport {
  public readonly scope: string;
  private readonly ws: WebSocketClient;

  public constructor(scope: string) {
    this.scope = scope;
    this.ws = WebSocketClient.connect("ws://localhost:8080");
  }

  public log(message: string): void {
    this.emit("log", message);
  }

  public error(message: string): void {
    this.emit("error", message);
  }

  public warn(message: string): void {
    this.emit("warn", message);
  }

  public debug(message: string): void {
    this.emit("debug", message);
  }

  private emit(level: LogLevel, message: string): void {
    const scope: string = this.scope;
    const payload: WebSocketTransportPayload = { level, scope, message };
    this.ws.emit(payload);
  }
}
