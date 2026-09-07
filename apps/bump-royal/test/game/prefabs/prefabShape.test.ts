import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AfterimageRenderer,
  Collider2D,
  INSTANTIATOR,
  ParticleEmitter,
  PlayerInput,
  RigidBody2D,
  SpriteRender,
  Tag,
  Transform2D,
} from "@atlasjs/gameplay";

import type { AtlasScript, GameEntity, Instantiator } from "@atlasjs/gameplay";
import { Vec2 } from "@atlasjs/math";

import { MoveIntent, PlayerStatus } from "../../../src/game/sim";
import { createPlayerSimPrefab } from "../../../src/game/sim/prefabs";

import { createGameHarness } from "../../helpers/engine";
import type { GameHarness } from "../../helpers/engine";

const FIXED_DELTA: number = 1 / 60;
const TICKS: number = 60;
const SIM_SCRIPT_COUNT: number = 3;

describe("playerSimPrefab shape", () => {
  let harness: GameHarness;
  let player: GameEntity;

  beforeEach(async () => {
    harness = await createGameHarness({ fixedDelta: FIXED_DELTA });

    const instantiator: Instantiator =
      harness.engine.services.get(INSTANTIATOR);

    player = instantiator.instantiate(createPlayerSimPrefab(), {
      position: new Vec2(0, 0),
    });
  });

  afterEach(() => {
    harness.stop();
  });

  it("carries the whole replicable simulation state", () => {
    expect(player.hasComponent(Transform2D)).toBe(true);
    expect(player.hasComponent(RigidBody2D)).toBe(true);
    expect(player.hasComponent(Collider2D)).toBe(true);
    expect(player.hasComponent(Tag)).toBe(true);
    expect(player.hasComponent(MoveIntent)).toBe(true);
    expect(player.hasComponent(PlayerStatus)).toBe(true);
  });

  it("carries nothing that only a client can render or read", () => {
    expect(player.hasComponent(SpriteRender)).toBe(false);
    expect(player.hasComponent(ParticleEmitter)).toBe(false);
    expect(player.hasComponent(AfterimageRenderer)).toBe(false);
    expect(player.hasComponent(PlayerInput)).toBe(false);
  });

  it("keeps every attached script enabled through 60 fixed ticks", () => {
    for (let i: number = 0; i < TICKS; i++) {
      harness.frame();
    }

    const scripts: readonly AtlasScript[] = harness.scripts.getScriptsByEntity(
      player.id,
    );

    const disabled: string[] = scripts
      .filter((script: AtlasScript): boolean => {
        return !harness.scripts.isEnabled(script);
      })
      .map((script: AtlasScript): string => script.constructor.name);

    expect(scripts).toHaveLength(SIM_SCRIPT_COUNT);
    expect(disabled).toEqual([]);
  });

  it("still moves under a held intent after those 60 ticks", () => {
    const intent: MoveIntent = harness.world.requireComponent(
      player.id,
      MoveIntent,
    );

    const transform: Transform2D = harness.world.requireComponent(
      player.id,
      Transform2D,
    );

    intent.direction.set(1, 0);

    for (let i: number = 0; i < TICKS; i++) {
      harness.frame();
    }

    expect(transform.position.x).toBeGreaterThan(0);
  });
});
