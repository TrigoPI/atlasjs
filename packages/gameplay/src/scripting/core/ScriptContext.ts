import { Entity } from "@atlasjs/nexus";

import type { GameEntity } from "./GameEntity";
import { ComponentAccess } from "./ComponentAccess";
import { ScriptServiceCtor } from "./ScriptService";
import type { InstantiateArgs, Prefab } from "./Prefab";

import type {
  Countdown,
  Repeater,
  Stopwatch,
  TimerHandle,
} from "../timers/types";

// prettier-ignore
export interface ScriptContext extends ComponentAccess {
  getEntityId(): Entity;

  getEntity(entity: Entity): GameEntity;

  getService<TFacade, TService>(type: ScriptServiceCtor<TFacade, TService>): TFacade;

  instantiate<TParams>(prefab: Prefab<TParams>, ...rest: InstantiateArgs<TParams>): GameEntity;
  destroy(): void;

  stopwatch(): Stopwatch;
  countdown(seconds: number): Countdown;
  every(seconds: number, callback: () => void): Repeater;
  cancel(handle: TimerHandle): void;
  advanceTimers(dt: number): void;
}
