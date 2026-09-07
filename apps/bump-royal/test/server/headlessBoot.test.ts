import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AtlasScript, RigidBody2D, Transform2D } from "@atlasjs/gameplay";
import type { GameEntity, Instantiator } from "@atlasjs/gameplay";
import { INSTANTIATOR, PlayerInput } from "@atlasjs/gameplay";
import { INPUT } from "@atlasjs/input";
import { Vec2 } from "@atlasjs/math";
import type { Entity } from "@atlasjs/nexus";

import { MoveIntent } from "../../src/game/sim/MoveIntent";
import { COLLIDER_RADIUS } from "../../src/game/sim/prefabs/buildPlayerSim";
import { createPlayerSimPrefab } from "../../src/game/sim/prefabs/PlayerSimPrefab";
import { ServerScene } from "../../src/server/ServerScene";

import { createGameHarness } from "../helpers/engine";
import type { GameHarness } from "../helpers/engine";
import { captureErrorLogs } from "../helpers/logCapture";
import type { LogCapture } from "../helpers/logCapture";

const FIXED_DELTA: number = 1 / 60;
const ONE_SECOND_OF_TICKS: number = 60;
const CANARY_TICKS: number = 120;
const SIM_SCRIPTS_PER_PLAYER: number = 3;

const SEED_SPAWNS: readonly Vec2[] = [new Vec2(0, 0), new Vec2(0, 100)];

const APPROACH_X: number = 100;
const APPROACH_TICKS: number = 60;

class ThrowingScript extends AtlasScript {
  public onCreate(): void {
    throw new Error("canary");
  }
}

function disabledScriptNames(
  harness: GameHarness,
  entity: Entity,
): readonly string[] {
  return harness.scripts
    .getScriptsByEntity(entity)
    .filter(
      (script: AtlasScript): boolean => !harness.scripts.isEnabled(script),
    )
    .map((script: AtlasScript): string => script.constructor.name);
}

describe("headless server boot", () => {
  let capture: LogCapture;
  let harness: GameHarness;

  beforeEach(async () => {
    capture = captureErrorLogs();
    harness = await createGameHarness({ fixedDelta: FIXED_DELTA });
  });

  afterEach(() => {
    harness.stop();
    capture.restore();
  });

  it("runs the same sim scripts the browser does, with no input plugin installed", async () => {
    const scene: ServerScene = new ServerScene(SEED_SPAWNS);
    await harness.engine.scene.set(scene);

    const [player]: readonly Entity[] = scene.getPlayers();

    const transform: Transform2D = harness.world.requireComponent(
      player,
      Transform2D,
    );

    expect(harness.engine.services.has(INPUT)).toBe(false);
    expect(harness.world.query(PlayerInput).size).toBe(0);
    expect(transform.position.x).toBe(0);

    /* The only producer of MoveIntent on the real server is applyNetIntents, which needs a
       socket. Writing the component directly is what that step would have done. */
    harness.world.requireComponent(player, MoveIntent).direction.set(1, 0);

    for (let i: number = 0; i < ONE_SECOND_OF_TICKS; i++) {
      harness.frame();
    }

    expect(transform.position.x).toBeGreaterThan(0);
  });

  it("disables no script and logs no error over 120 ticks", async () => {
    const scene: ServerScene = new ServerScene(SEED_SPAWNS);
    await harness.engine.scene.set(scene);

    for (let i: number = 0; i < CANARY_TICKS; i++) {
      harness.frame();
    }

    for (const player of scene.getPlayers()) {
      expect(harness.scripts.getScriptsByEntity(player)).toHaveLength(
        SIM_SCRIPTS_PER_PLAYER,
      );

      expect(disabledScriptNames(harness, player)).toEqual([]);
    }

    expect(capture.errors).toEqual([]);
  });

  it("would have caught a script that threw, so the canary above is not vacuous", () => {
    const entity: Entity = harness.world.createEntity();
    harness.scripts.attach(entity, ThrowingScript);

    harness.frame();

    expect(
      harness.scripts.isEnabled(harness.scripts.getScriptsByEntity(entity)[0]),
    ).toBe(false);
    expect(capture.errors).toHaveLength(1);
    expect(capture.errors[0]).toContain("ThrowingScript");
  });

  it("steps rapier in Node: two players on a collision course bump and separate", () => {
    const instantiator: Instantiator =
      harness.engine.services.get(INSTANTIATOR);

    const left: GameEntity = instantiator.instantiate(createPlayerSimPrefab(), {
      position: new Vec2(-APPROACH_X, 0),
    });

    const right: GameEntity = instantiator.instantiate(
      createPlayerSimPrefab(),
      {
        position: new Vec2(APPROACH_X, 0),
      },
    );

    harness.world.requireComponent(left.id, MoveIntent).direction.set(1, 0);
    harness.world.requireComponent(right.id, MoveIntent).direction.set(-1, 0);

    const leftBody: RigidBody2D = harness.world.requireComponent(
      left.id,
      RigidBody2D,
    );

    const rightBody: RigidBody2D = harness.world.requireComponent(
      right.id,
      RigidBody2D,
    );

    const leftTransform: Transform2D = harness.world.requireComponent(
      left.id,
      Transform2D,
    );

    const rightTransform: Transform2D = harness.world.requireComponent(
      right.id,
      Transform2D,
    );

    let minGap: number = Number.POSITIVE_INFINITY;
    let bounced: boolean = false;

    for (let i: number = 0; i < APPROACH_TICKS; i++) {
      harness.frame();

      minGap = Math.min(
        minGap,
        rightTransform.position.x - leftTransform.position.x,
      );

      if (leftBody.velocity.x < 0 && rightBody.velocity.x > 0) {
        bounced = true;
      }
    }

    const finalGap: number =
      rightTransform.position.x - leftTransform.position.x;

    expect(minGap).toBeLessThan(COLLIDER_RADIUS * 2 + 1);
    expect(bounced).toBe(true);
    expect(finalGap).toBeGreaterThan(minGap);
    expect(capture.errors).toEqual([]);
  });
});
