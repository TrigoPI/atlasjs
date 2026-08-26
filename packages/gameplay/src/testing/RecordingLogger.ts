import { type LogTransport, Logger } from "@atlasjs/utils";

export class RecordingLogTransport implements LogTransport {
  public readonly scope: string;
  public readonly logs: string[];
  public readonly warnings: string[];
  public readonly errors: string[];
  public readonly debugs: string[];

  public constructor(scope: string = "ScriptHarness") {
    this.scope = scope;
    this.logs = [];
    this.warnings = [];
    this.errors = [];
    this.debugs = [];
  }

  public log(message: string): void {
    this.logs.push(message);
  }

  public warn(message: string): void {
    this.warnings.push(message);
  }

  public error(message: string): void {
    this.errors.push(message);
  }

  public debug(message: string): void {
    this.debugs.push(message);
  }
}

export interface RecordingLogger {
  readonly logger: Logger;
  readonly transport: RecordingLogTransport;
}

export function createRecordingLogger(scope?: string): RecordingLogger {
  const transport: RecordingLogTransport = new RecordingLogTransport(scope);

  return { logger: new Logger([transport]), transport };
}
