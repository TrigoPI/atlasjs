export type LogLevel = "log" | "error" | "warn" | "debug";

export type LogPayload = {
  level: LogLevel;
  scope: string;
  message: string;
};
