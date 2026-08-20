import { ServiceRegistry } from "./ServiceRegistry";
import { ServiceToken } from "./types";

/**
 * Scales how fast time flows for every lane of the loop: fixed steps,
 * script updates and animations alike. 0 freezes the simulation while
 * rendering keeps running.
 */
export interface TimeControl {
  /** Clamped to 0 or above. 1 is real time. */
  scale: number;
}

export const TIME: ServiceToken<TimeControl> =
  ServiceRegistry.createToken<TimeControl>("TIME");
