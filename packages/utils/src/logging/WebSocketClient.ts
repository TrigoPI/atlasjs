import { WebSocketTransportPayload } from "./types";

export class WebSocketClient {
  private static _instance: WebSocketClient;

  private readonly ws: WebSocket;
  private readonly buffer: WebSocketTransportPayload[] = [];

  private constructor(url: string) {
    this.buffer = [];
    this.ws = new WebSocket(url);

    this.ws.onopen = () => this.flushBuffer();
    this.ws.onclose = () => console.warn("WebSocket connection closed");
  }

  public emit(payload: WebSocketTransportPayload): void {
    this.buffer.push(payload);

    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private flushBuffer(): void {
    while (this.buffer.length > 0) {
      const payload: WebSocketTransportPayload | undefined =
        this.buffer.shift();

      if (payload && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(payload));
      }
    }
  }

  public static connect(url: string): WebSocketClient {
    if (!WebSocketClient._instance) {
      WebSocketClient._instance = new WebSocketClient(url);
    }

    return WebSocketClient._instance;
  }
}
