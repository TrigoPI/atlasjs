import { afterEach, describe, expect, it } from "vitest";

import {
  Collider,
  PhysicsBodyRef,
  RigidBody,
  Transform2D,
} from "@atlasjs/gameplay";
import { Vec2 } from "@atlasjs/math";
import type { StepContext } from "@atlasjs/core";
import type { Entity } from "@atlasjs/nexus";

import { ARENA_BOUNDS } from "../../../../src/game/arena";
import { PlayerFallSimScript } from "../../../../src/game/script/player/PlayerFallSimScript";
import { PlayerMovementScript } from "../../../../src/game/script/player/PlayerMovementScript";

import {
  MoveIntent,
  PlayerStatus,
  registerLocalIntent,
} from "../../../../src/game/sim";

import { createGameHarness } from "../../../helpers/engine";
import type { GameHarness } from "../../../helpers/engine";

const FIXED_DELTA: number = 1 / 60;
const FALL_DURATION: number = 0.35;
const FALL_TICKS: number = 21;
const COLLIDER_RADIUS: number = 28;

const MOVEMENT_PROPS = {
  maxSpeed: 300,
  acceleration: 600,
  deceleration: 300,
  overspeedDeceleration: 1600,
  dashSpeed: 700,
  dashDuration: 0.25,
  dashCooldown: 0.5,
};

type Sample = {
  tick: number;
  falling: boolean;
  fallCount: number;
  respawnCount: number;
  collidesWith: number;
  position: Vec2;
  velocity: Vec2;
};

type Player = {
  entity: Entity;
  script: PlayerFallSimScript;
  status: PlayerStatus;
  intent: MoveIntent;
  transform: Transform2D;
  collider: Collider;
  rigidBody: RigidBody;
  samples: Sample[];
};

function spawnFallingPlayer(
  harness: GameHarness,
  position: Vec2,
  respawnPosition: Vec2,
): Player {
  const entity: Entity = harness.world.createEntity();

  const transform: Transform2D = harness.world.addComponent(
    entity,
    Transform2D,
  );

  transform.position.copyFrom(position);
  transform.scale.set(1, 1);

  const rigidBody: RigidBody = harness.world.addComponent(entity, RigidBody);
  rigidBody.type = "dynamic";
  rigidBody.lockRotation = true;

  const collider: Collider = harness.world.addComponent(entity, Collider, {
    type: "circle",
    radius: COLLIDER_RADIUS,
  });

  const status: PlayerStatus = harness.world.addComponent(entity, PlayerStatus);
  const intent: MoveIntent = harness.world.addComponent(entity, MoveIntent);

  const script: PlayerFallSimScript = harness.scripts.attach(
    entity,
    PlayerFallSimScript,
    {
      bounds: ARENA_BOUNDS,
      radius: COLLIDER_RADIUS,
      fallDuration: FALL_DURATION,
      respawnPosition,
    },
  );

  const samples: Sample[] = [];

  harness.scheduler.add(
    "fixed",
    (ctx: StepContext): void => {
      samples.push({
        tick: ctx.tick,
        falling: status.falling,
        fallCount: status.fallCount,
        respawnCount: status.respawnCount,
        collidesWith: collider.collidesWith,
        position: transform.position.clone(),
        velocity: rigidBody.velocity.clone(),
      });
    },
    { name: "test:sample-fall", stage: "Sync" },
  );

  return {
    entity,
    script,
    status,
    intent,
    transform,
    collider,
    rigidBody,
    samples,
  };
}

function outsidePosition(): Vec2 {
  return new Vec2(ARENA_BOUNDS.halfWidth * 4, 0);
}

function tickOf(samples: Sample[], predicate: (s: Sample) => boolean): number {
  const found: Sample | undefined = samples.find(predicate);

  if (found === undefined) {
    throw new Error("no sample matched");
  }

  return found.tick;
}

describe("PlayerFallSimScript", () => {
  const harnesses: GameHarness[] = [];

  async function boot(): Promise<GameHarness> {
    const harness: GameHarness = await createGameHarness({
      fixedDelta: FIXED_DELTA,
    });

    harnesses.push(harness);
    return harness;
  }

  afterEach(() => {
    for (const harness of harnesses) {
      harness.stop();
    }

    harnesses.length = 0;
  });

  it("flips `falling` on the same fixed tick across two identical runs", async () => {
    const runs: Sample[][] = [];

    for (let i: number = 0; i < 2; i++) {
      const harness: GameHarness = await boot();
      const player: Player = spawnFallingPlayer(
        harness,
        outsidePosition(),
        new Vec2(0, 0),
      );

      harness.frame(4);
      runs.push(player.samples);
    }

    const first: number = tickOf(runs[0], (s: Sample): boolean => s.falling);
    const second: number = tickOf(runs[1], (s: Sample): boolean => s.falling);

    expect(first).toBe(1);
    expect(second).toBe(first);
    expect(runs[0].map((s: Sample): boolean => s.falling)).toEqual(
      runs[1].map((s: Sample): boolean => s.falling),
    );
  });

  it("stays enabled and fed by a live physics round-trip in an engine with no AudioPlugin", async () => {
    const harness: GameHarness = await boot();
    const player: Player = spawnFallingPlayer(
      harness,
      new Vec2(0, 0),
      new Vec2(0, 0),
    );

    harness.frame();

    expect(harness.scripts.isEnabled(player.script)).toBe(true);
    expect(harness.world.hasComponent(player.entity, PhysicsBodyRef)).toBe(
      true,
    );

    player.rigidBody.velocity.set(600, 0);
    harness.frame();

    expect(player.transform.position.x).toBeGreaterThan(0);
    expect(player.transform.position.x).toBeCloseTo(600 * FIXED_DELTA, 3);
    expect(player.status.falling).toBe(false);
  });

  it("does not fall while inside the arena", async () => {
    const harness: GameHarness = await boot();
    const player: Player = spawnFallingPlayer(
      harness,
      new Vec2(0, 0),
      new Vec2(0, 0),
    );

    harness.frame(30);

    expect(player.status.falling).toBe(false);
    expect(player.status.fallCount).toBe(0);
    expect(player.samples.some((s: Sample): boolean => s.falling)).toBe(false);
  });

  it("respawns after a fixed number of ticks whatever the frame dt", async () => {
    const patterns: number[][] = [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [3, 3, 3, 3, 3, 3, 3, 3],
      [2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5],
      [7, 1, 0.5, 0.5, 4, 2.5, 1, 9],
    ];

    const spans: number[] = [];

    for (const pattern of patterns) {
      const harness: GameHarness = await boot();
      const player: Player = spawnFallingPlayer(
        harness,
        outsidePosition(),
        new Vec2(0, 0),
      );

      for (const ticks of pattern) {
        harness.frame(ticks);
      }

      const fallTick: number = tickOf(
        player.samples,
        (s: Sample): boolean => s.fallCount === 1,
      );

      const respawnTick: number = tickOf(
        player.samples,
        (s: Sample): boolean => s.respawnCount === 1,
      );

      spans.push(respawnTick - fallTick);
    }

    expect(spans).toEqual([FALL_TICKS, FALL_TICKS, FALL_TICKS, FALL_TICKS]);
  });

  it("lands exactly on the respawn point at the end of the respawn tick", async () => {
    const harness: GameHarness = await boot();
    const respawnPosition: Vec2 = new Vec2(100, -50);

    const player: Player = spawnFallingPlayer(
      harness,
      outsidePosition(),
      respawnPosition,
    );

    harness.frame(FALL_TICKS + 1);

    const respawnTick: number = tickOf(
      player.samples,
      (s: Sample): boolean => s.respawnCount === 1,
    );

    const landed: Sample = player.samples[respawnTick - 1];

    expect(landed.respawnCount).toBe(1);
    expect(landed.falling).toBe(false);
    expect(landed.position.x).toBe(respawnPosition.x);
    expect(landed.position.y).toBe(respawnPosition.y);
    expect(player.transform.position.x).toBe(respawnPosition.x);
    expect(player.transform.position.y).toBe(respawnPosition.y);

    const bodyRef: PhysicsBodyRef = harness.world.requireComponent(
      player.entity,
      PhysicsBodyRef,
    );

    expect(bodyRef.body.getTranslation().x).toBe(respawnPosition.x);
    expect(bodyRef.body.getTranslation().y).toBe(respawnPosition.y);
  });

  it("zeroes `collidesWith` for the whole fall and restores it on respawn", async () => {
    const harness: GameHarness = await boot();
    const player: Player = spawnFallingPlayer(
      harness,
      outsidePosition(),
      new Vec2(0, 0),
    );

    const base: number = player.collider.collidesWith;

    expect(base).not.toBe(0);

    harness.frame(FALL_TICKS + 1);

    const falling: Sample[] = player.samples.filter(
      (s: Sample): boolean => s.falling,
    );

    expect(falling).toHaveLength(FALL_TICKS);
    expect(falling.every((s: Sample): boolean => s.collidesWith === 0)).toBe(
      true,
    );

    const landed: Sample = player.samples[FALL_TICKS];

    expect(landed.respawnCount).toBe(1);
    expect(landed.collidesWith).toBe(base);
    expect(player.collider.collidesWith).toBe(base);
  });

  it("keeps PlayerMovementScript inert while falling and drops the buffered dash", async () => {
    const harness: GameHarness = await boot();
    registerLocalIntent(harness.scheduler, harness.world);

    const player: Player = spawnFallingPlayer(
      harness,
      outsidePosition(),
      new Vec2(0, 0),
    );

    harness.scripts.attach(player.entity, PlayerMovementScript, MOVEMENT_PROPS);

    player.intent.direction.set(0, 1);
    player.intent.dashLatched = true;

    for (let i: number = 0; i < FALL_TICKS; i++) {
      harness.frame();

      expect(player.status.falling).toBe(true);
      expect(player.rigidBody.velocity.x).toBe(0);
      expect(player.rigidBody.velocity.y).toBe(0);
      expect(player.status.facing.x).toBe(1);
      expect(player.status.facing.y).toBe(0);
      expect(player.status.dashRemaining).toBe(0);
    }

    harness.frame();

    expect(player.status.falling).toBe(false);
    expect(player.status.respawnCount).toBe(1);
    expect(player.status.dashRemaining).toBe(0);
    expect(player.rigidBody.velocity.y).toBeCloseTo(
      MOVEMENT_PROPS.acceleration * FIXED_DELTA,
      3,
    );
    expect(player.rigidBody.velocity.y).toBeLessThan(MOVEMENT_PROPS.dashSpeed);
  });
});
