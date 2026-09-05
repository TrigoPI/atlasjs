import type { Collision } from "./Collision";
import type { GameEntity } from "./GameEntity";

export interface ScriptLifecycle {
  onCreate?(): void;
  onUpdate?(dt: number): void;
  onFixedUpdate?(dt: number): void;
  onDestroy?(): void;
  /**
   * @param collision The contact, or `null` when the backend cannot produce
   * one. **Borrowed, not given:** it is valid for the duration of this call
   * only — copy `point` and `normal` to keep them. Its normal points from
   * `other` towards this entity.
   */
  onCollisionEnter?(other: GameEntity, collision: Collision | null): void;
  onCollisionExit?(other: GameEntity): void;
  onTriggerEnter?(other: GameEntity): void;
  onTriggerExit?(other: GameEntity): void;
}
