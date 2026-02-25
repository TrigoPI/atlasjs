import { LogTransport } from "./LogTransport";

export class ConsoleTransport implements LogTransport {
  public readonly scope: string;

  constructor(scope: string) {
    this.scope = scope;
  }

  public log(message: string): void {
    console.log(`[LOG] [${this.scope}] ${message}`);
  }

  public error(message: string): void {
    console.error(`[ERROR] [${this.scope}] ${message}`);
  }

  public warn(message: string): void {
    console.warn(`[WARN] [${this.scope}] ${message}`);
  }

  public debug(message: string): void {
    console.debug(`[DEBUG] [${this.scope}] ${message}`);
  }
}
