import { Vec2 } from "@atlasjs/math";

import {
  AtlasScript,
  Collider,
  PhysicsBodyRef,
  registerScriptMetadata,
  RigidBody,
  ScriptMetadata,
  Transform2D,
} from "@atlasjs/gameplay";

import { isInsideArena, type ArenaBounds } from "../../arena";

type PlayerFallScriptProps = {
  bounds: ArenaBounds;
  radius: number;
  fallDuration: number;
  respawnPosition: Vec2;
};

export class PlayerFallScript extends AtlasScript<PlayerFallScriptProps> {
  private readonly bounds: ArenaBounds;
  private readonly radius: number;
  private readonly fallDuration: number;
  private readonly respawnPosition: Vec2;

  private readonly baseScale: Vec2 = new Vec2();

  private transform: Transform2D;
  private collider: Collider;
  private rigidBody: RigidBody;
  private collidesWith: number;
  private falling: boolean;
  private elapsed: number;

  public onCreate(): void {
    this.transform = this.requireComponent(Transform2D);
    this.collider = this.requireComponent(Collider);
    this.rigidBody = this.requireComponent(RigidBody);

    this.baseScale.copyFrom(this.transform.scale);
    this.collidesWith = this.collider.collidesWith;
    this.falling = false;
    this.elapsed = 0;
  }

  public get isFalling(): boolean {
    return this.falling;
  }

  public onUpdate(dt: number): void {
    if (!this.falling) {
      if (!isInsideArena(this.bounds, this.transform.position, this.radius)) {
        this.startFall();
      }

      return;
    }

    this.rigidBody.velocity.set(0, 0);
    this.elapsed = Math.min(this.elapsed + dt, this.fallDuration);

    const t: number = this.elapsed / this.fallDuration;
    this.transform.scale.copyFrom(this.baseScale).mult(1 - t);

    if (this.elapsed >= this.fallDuration) {
      this.respawn();
    }
  }

  private startFall(): void {
    this.falling = true;
    this.elapsed = 0;
    this.collider.collidesWith = 0;
  }

  private respawn(): void {
    const bodyRef: PhysicsBodyRef | undefined =
      this.getComponent(PhysicsBodyRef);

    bodyRef?.body.setTranslation(
      this.respawnPosition.x,
      this.respawnPosition.y,
    );

    this.transform.position.copyFrom(this.respawnPosition);
    this.transform.scale.copyFrom(this.baseScale);
    this.rigidBody.velocity.set(0, 0);
    this.collider.collidesWith = this.collidesWith;
    this.falling = false;
  }
}

registerScriptMetadata(PlayerFallScript, {
  exposed: {
    bounds: ScriptMetadata.field({ required: true }),
    radius: ScriptMetadata.field({ required: true }),
    fallDuration: ScriptMetadata.field({ required: true }),
    respawnPosition: ScriptMetadata.field({ required: true }),
  },
});
