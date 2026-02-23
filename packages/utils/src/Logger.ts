import { LogLevel } from "./types";

export interface Logger {
  level: LogLevel;
  scope: string;

  log(message: string): void;
  error(message: string): void;
  warn(message: string): void;
  debug(message: string): void;
}

export class NullLogger implements Logger {
  level: LogLevel;
  scope: string;

  constructor(scope?: string) {
    this.level = "silent";
    this.scope = scope || "Atlas";
  }

  public error(): void {}
  public warn(): void {}
  public log(): void {}
  public debug(): void {}
}

export class ConsoleLogger implements Logger {
  level: LogLevel;
  scope: string;

  constructor(level: LogLevel, scope?: string) {
    this.level = level;
    this.scope = scope || "Atlas";
  }

  public error(message: string): void {
    console.error(`[${this.scope}] [ERROR]: ${message}`);
  }

  public warn(message: string): void {
    console.warn(`[${this.scope}] [WARN]: ${message}`);
  }

  public log(message: string): void {
    console.log(`[${this.scope}] [LOG]: ${message}`);
  }

  public debug(message: string): void {
    console.debug(`[${this.scope}] [DEBUG]: ${message}`);
  }
}

export function createLogger(level: LogLevel, scope?: string): Logger {
  if (__DEV__) return new ConsoleLogger(level, scope);
  return new NullLogger(scope);
}
