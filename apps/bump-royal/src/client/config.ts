import { DEFAULT_SERVER_PORT } from "../net/protocol";

export const ONLINE_PARAM: string = "online";
export const SERVER_PARAM: string = "server";
export const ONLINE_VALUE: string = "1";

const LOCALHOST: string = "localhost";

export type OnlineConfig = {
  readonly online: boolean;
  readonly serverUrl: string;
};

/* Pure on purpose: the query string, the page host and the build-time override all come in as
   arguments so the resolution order is testable without a browser. */
export function readOnlineConfig(
  search: string,
  hostname: string,
  envUrl: string | undefined,
): OnlineConfig {
  const params: URLSearchParams = new URLSearchParams(search);
  const fromQuery: string | null = params.get(SERVER_PARAM);

  const host: string = hostname === "" ? LOCALHOST : hostname;
  const fallback: string = `ws://${host}:${DEFAULT_SERVER_PORT}`;

  return {
    online: params.get(ONLINE_PARAM) === ONLINE_VALUE,
    serverUrl: fromQuery ?? envUrl ?? fallback,
  };
}
