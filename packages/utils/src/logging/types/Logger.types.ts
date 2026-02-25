export type LogLevel = "log" | "error" | "warn" | "debug" | "silent";

export type LogMeta = {
  scope: string;
};

export type WebSocketTransportPayload = {
  level: LogLevel;
  scope: string;
  message: string;
};
