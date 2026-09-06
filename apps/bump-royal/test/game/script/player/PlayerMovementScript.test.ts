import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { RigidBody } from "@atlasjs/gameplay";
import type { Entity } from "@atlasjs/nexus";
import type { Vec2 } from "@atlasjs/math";

import {
  MoveIntent,
  PlayerStatus,
  registerLocalIntent,
} from "../../../../src/game/sim";
import { PlayerMovementScript } from "../../../../src/game/script/player/PlayerMovementScript";
import { createGameHarness, FIXED } from "../../../helpers/engine";
import type { GameHarness } from "../../../helpers/engine";

const PROPS = {
  maxSpeed: 300,
  acceleration: 600,
  deceleration: 300,
  overspeedDeceleration: 1600,
  dashSpeed: 700,
  dashDuration: 0.25,
  dashCooldown: 0.5,
};

const ACCEL_STEP: number = PROPS.acceleration * FIXED;
const DECEL_STEP: number = PROPS.deceleration * FIXED;
const OVERSPEED_STEP: number = PROPS.overspeedDeceleration * FIXED;

type Player = {
  intent: MoveIntent;
  status: PlayerStatus;
  velocity: Vec2;
};

describe("PlayerMovementScript", () => {
  let harness: GameHarness;
  let player: Player;

  beforeEach(async () => {
    harness = await createGameHarness();
    registerLocalIntent(harness.scheduler, harness.world);

    const entity: Entity = harness.world.createEntity();
    const body: RigidBody = harness.world.addComponent(entity, RigidBody);
    const intent: MoveIntent = harness.world.addComponent(entity, MoveIntent);

    const status: PlayerStatus = harness.world.addComponent(
      entity,
      PlayerStatus,
    );

    harness.scripts.attach(entity, PlayerMovementScript, PROPS);

    player = { intent, status, velocity: body.velocity };
  });

  afterEach(() => {
    harness.stop();
  });

  it("ramps velocity toward maxSpeed at `acceleration` while a direction is held", () => {
    player.intent.direction.set(1, 0);

    harness.frame();
    expect(player.velocity.x).toBe(ACCEL_STEP);

    harness.frame();
    expect(player.velocity.x).toBe(ACCEL_STEP * 2);

    harness.frame(2);
    expect(player.velocity.x).toBe(PROPS.maxSpeed);

    harness.frame();
    expect(player.velocity.x).toBe(PROPS.maxSpeed);
  });

  it("decelerates to exactly zero and does not overshoot", () => {
    player.velocity.set(PROPS.maxSpeed, 0);
    player.intent.direction.set(0, 0);

    harness.frame();
    expect(player.velocity.x).toBe(PROPS.maxSpeed - DECEL_STEP);

    harness.frame(PROPS.maxSpeed / DECEL_STEP - 1);
    expect(player.velocity.x).toBe(0);
    expect(player.velocity.y).toBe(0);

    harness.frame();
    expect(player.velocity.x).toBe(0);
  });

  it("selects `overspeedDeceleration` above maxSpeed even with the input held along the velocity", () => {
    player.velocity.set(PROPS.dashSpeed, 0);
    player.intent.direction.set(1, 0);

    harness.frame();

    expect(player.velocity.x).toBe(PROPS.dashSpeed - OVERSPEED_STEP);
    expect(player.velocity.x).not.toBe(PROPS.dashSpeed - ACCEL_STEP);
    expect(player.velocity.x).not.toBe(PROPS.dashSpeed - DECEL_STEP);
  });

  it("buffers a dash requested during the cooldown and fires it when the cooldown expires", () => {
    player.intent.direction.set(1, 0);
    player.intent.dashLatched = true;

    harness.frame();
    expect(player.velocity.x).toBe(PROPS.dashSpeed);

    harness.frame(2);
    expect(player.velocity.x).toBe(PROPS.dashSpeed);

    player.intent.dashLatched = true;

    harness.frame();
    expect(player.velocity.x).toBe(PROPS.dashSpeed - OVERSPEED_STEP);

    harness.frame();
    expect(player.velocity.x).toBe(PROPS.maxSpeed);
    expect(player.intent.dash).toBe(false);

    harness.frame();
    expect(player.intent.dash).toBe(false);
    expect(player.velocity.x).toBe(PROPS.dashSpeed);
  });

  it("dashes along the last non-zero intent direction", () => {
    player.intent.direction.set(0, 1);

    harness.frame();
    expect(player.velocity.y).toBe(ACCEL_STEP);

    player.intent.direction.set(0, 0);
    player.intent.dashLatched = true;

    harness.frame();
    expect(player.velocity.x).toBe(0);
    expect(player.velocity.y).toBe(PROPS.dashSpeed);
    expect(player.status.facing.x).toBe(0);
    expect(player.status.facing.y).toBe(1);
  });

  it("starts exactly one dash when the fixed lane runs twice on a single dash edge", () => {
    player.intent.direction.set(1, 0);
    player.intent.dashLatched = true;

    harness.frame(2);
    expect(player.velocity.x).toBe(PROPS.dashSpeed);
    expect(player.intent.dash).toBe(false);

    harness.frame();
    expect(player.velocity.x).toBe(PROPS.dashSpeed);

    harness.frame();
    expect(player.velocity.x).toBe(PROPS.dashSpeed - OVERSPEED_STEP);
  });
});
