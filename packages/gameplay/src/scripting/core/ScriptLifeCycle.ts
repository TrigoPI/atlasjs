import type { GameEntity } from "./GameEntity";

export interface ScriptLifecycle {
  onCreate?(): void;
  onUpdate?(dt: number): void;
  onFixedUpdate?(): void;
  onDestroy?(): void;
  onCollisionEnter?(other: GameEntity): void;
  onCollisionExit?(other: GameEntity): void;
  onTriggerEnter?(other: GameEntity): void;
  onTriggerExit?(other: GameEntity): void;
}
