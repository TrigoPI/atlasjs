import type { Vec2 } from "@atlasjs/math";

import {
  Collider2D,
  RigidBody,
  Tag,
  Transform2D,
  type EntityBuilder,
} from "@atlasjs/gameplay";

import { ARENA_BOUNDS } from "../arena/bounds";
import { MoveIntent } from "../MoveIntent";
import { PlayerStatus } from "../PlayerStatus";
import { PlayerFallSimScript } from "../script/player/PlayerFallSimScript";
import {
  PlayerMovementScript,
  type PlayerMovementProps,
} from "../script/player/PlayerMovementScript";

export type PlayerSimProps = {
  position: Vec2;
};

const RADIUS: number = 8;

/* Exported because the online view prefab has to reproduce it exactly: every child of
   buildPlayerView is placed in a local space that assumes this root scale. */
export const PLAYER_SCALE: number = 3.5;

export const COLLIDER_RADIUS: number = PLAYER_SCALE * RADIUS;

export const FALL_DURATION: number = 0.35;

export const PLAYER_MOVEMENT: PlayerMovementProps = {
  maxSpeed: 300,
  acceleration: 600,
  deceleration: 300,
  dashSpeed: 700,
  dashDuration: 0.18,
  dashCooldown: 0.6,
  overspeedDeceleration: 5000,
};

// prettier-ignore
export function buildPlayerSim(
  entity: EntityBuilder,
  props: PlayerSimProps,
): void {
  const transform: Transform2D = entity.add(Transform2D);
  transform.position.copyFrom(props.position);
  transform.scale.set(PLAYER_SCALE, PLAYER_SCALE);

  const body: RigidBody = entity.add(RigidBody);
  body.type = "dynamic";
  body.lockRotation = true;

  const collider: Collider2D = entity.add(Collider2D, { type: "circle", radius: COLLIDER_RADIUS });
  collider.restitution = 1;
  collider.friction = 0.05;

  entity.add(Tag, "Player");
  entity.add(MoveIntent);
  entity.add(PlayerStatus);

  entity.attach(PlayerFallSimScript, {
    bounds: ARENA_BOUNDS,
    radius: COLLIDER_RADIUS,
    fallDuration: FALL_DURATION,
    respawnPosition: props.position.clone(),
  });

  entity.attach(PlayerMovementScript, PLAYER_MOVEMENT);
}
