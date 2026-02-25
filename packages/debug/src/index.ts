import { WebSocketServer, WebSocket, RawData } from "ws";
import { LogPayload } from "./types";
import { LogLevel } from "./types";

const port: number = 8080;
const wss: WebSocketServer = new WebSocketServer({ port });

const colors: Record<LogLevel, string> = {
  error: "\x1b[31m",
  log: "\x1b[34m",
  warn: "\x1b[33m",
  debug: "\x1b[32m",
};

wss.on("connection", (ws: WebSocket) => {
  ws.on("message", (data: RawData) => {
    const logPayload: LogPayload = JSON.parse(data.toString());
    console.log(
      `${colors[logPayload.level]}[${logPayload.level.toLocaleUpperCase()}] [${logPayload.scope}] ${logPayload.message}\x1b[0m`,
    );
  });
});

console.clear();
console.log(
  `${colors.log}[LOG] 🔌 Atlas Log Server listening on ws://localhost:${port}\x1b[0m`,
);
