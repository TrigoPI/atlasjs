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
import { PlayerMovementScript } from "../script/player/PlayerMovementScript";

export type PlayerSimProps = {
  position: Vec2;
};

const SCALE: number = 3.5;
const RADIUS: number = 8;
const COLLIDER_RADIUS: number = SCALE * RADIUS;

export const FALL_DURATION: number = 0.35;

// prettier-ignore
export function buildPlayerSim(
  entity: EntityBuilder,
  props: PlayerSimProps,
): void {
  const transform: Transform2D = entity.add(Transform2D);
  transform.position.copyFrom(props.position);
  transform.scale.set(SCALE, SCALE);

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

  entity.attach(PlayerMovementScript, {
    maxSpeed: 300,
    acceleration: 600,
    deceleration: 300,
    dashSpeed: 700,
    dashDuration: 0.18,
    dashCooldown: 0.6,
    overspeedDeceleration: 5000,
  });
}
