import type { Vec2 } from "@atlasjs/math";

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
import { PlayerStatus } from "../../sim";

type PlayerFallSimScriptProps = {
  bounds: ArenaBounds;
  radius: number;
  fallDuration: number;
  respawnPosition: Vec2;
};

export class PlayerFallSimScript extends AtlasScript<PlayerFallSimScriptProps> {
  private readonly bounds: ArenaBounds;
  private readonly radius: number;
  private readonly fallDuration: number;
  private readonly respawnPosition: Vec2;

  private transform: Transform2D;
  private collider: Collider;
  private rigidBody: RigidBody;
  private status: PlayerStatus;
  private collidesWith: number;

  public onCreate(): void {
    this.transform = this.requireComponent(Transform2D);
    this.collider = this.requireComponent(Collider);
    this.rigidBody = this.requireComponent(RigidBody);
    this.status = this.requireComponent(PlayerStatus);

    this.collidesWith = this.collider.collidesWith;
  }

  public onFixedUpdate(dt: number): void {
    if (!this.status.falling) {
      if (!isInsideArena(this.bounds, this.transform.position, this.radius)) {
        this.startFall();
      }

      return;
    }

    this.rigidBody.velocity.set(0, 0);

    this.status.fallElapsed = Math.min(
      this.status.fallElapsed + dt,
      this.fallDuration,
    );

    if (this.status.fallElapsed >= this.fallDuration) {
      this.respawn();
    }
  }

  private startFall(): void {
    this.status.falling = true;
    this.status.fallElapsed = 0;
    this.status.fallCount++;
    this.collider.collidesWith = 0;
  }

  private respawn(): void {
    const bodyRef: PhysicsBodyRef | undefined =
      this.getComponent(PhysicsBodyRef);

    bodyRef?.body.setTranslation(
      this.respawnPosition.x,
      this.respawnPosition.y,
    );

    /* PhysicsPullSystem (PhysicsWriteback, 400) rewrites Transform2D.position from the body
       later in this same tick, so this write looks dead. It is not: script order inside
       ScriptFixed (150) is attach order, so any other fixed-lane script reading
       Transform2D.position between stage 150 and stage 400 reads the pre-respawn value
       without it. Do not delete. See PHYSICS-25. */
    this.transform.position.copyFrom(this.respawnPosition);

    this.rigidBody.velocity.set(0, 0);
    this.collider.collidesWith = this.collidesWith;

    this.status.falling = false;
    this.status.fallElapsed = 0;
    this.status.respawnCount++;
  }
}

registerScriptMetadata(PlayerFallSimScript, {
  exposed: {
    bounds: ScriptMetadata.field({ required: true }),
    radius: ScriptMetadata.field({ required: true }),
    fallDuration: ScriptMetadata.field({ required: true }),
    respawnPosition: ScriptMetadata.field({ required: true }),
  },
});
