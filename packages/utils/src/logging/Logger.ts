import { ConsoleTransport } from "./ConsoleTransport";
import { LogTransport } from "./LogTransport";
import { WebSocketTransport } from "./WebSocketTransport";

export class Logger {
  private readonly transports: LogTransport[];

  constructor(transports: LogTransport[]) {
    this.transports = transports;
  }

  public error(message: string): void {
    for (const transport of this.transports) {
      transport.error(message);
    }
  }

  public warn(message: string): void {
    for (const transport of this.transports) {
      transport.warn(message);
    }
  }

  public log(message: string): void {
    for (const transport of this.transports) {
      transport.log(message);
    }
  }

  public debug(message: string): void {
    for (const transport of this.transports) {
      transport.debug(message);
    }
  }
}

export function createLogger(scope?: string): Logger {
  if (__DEV__)
    return new Logger([
      // new ConsoleTransport(scope || "Atlas"),
      // new WebSocketTransport(scope || "Atlas"),
    ]);
  return new Logger([]);
}
