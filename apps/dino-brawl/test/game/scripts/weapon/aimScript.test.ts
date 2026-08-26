import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";
import { CameraApi, InputApi, Transform } from "@atlasjs/gameplay";
import {
  createScriptHarness,
  type ScriptHarness,
} from "@atlasjs/gameplay/testing";

import { readAimAngle } from "../../../../src/game/scripts/weapon/aim";
import { AimScript } from "../../../../src/game/scripts/weapon/AimScript";

type MutableInput = { mousePosition: Vec2 };

type StubTransform = { worldPosition: Vec2 };

type Rig = {
  aim: AimScript;
  input: InputApi & MutableInput;
  camera: CameraApi;
  transform: StubTransform;
};

function createInput(mousePosition: Vec2): InputApi & MutableInput {
  return { mousePosition } as unknown as InputApi & MutableInput;
}

function createCamera(): CameraApi {
  return {
    screenToWorld: (screen: Vec2): Vec2 => screen,
  } as unknown as CameraApi;
}

function createRig(
  origin: Vec2 = Vec2.zero(),
  mousePosition: Vec2 = new Vec2(10, 0),
): Rig {
  const input: InputApi & MutableInput = createInput(mousePosition);
  const camera: CameraApi = createCamera();
  const transform: StubTransform = { worldPosition: origin };

  const harness: ScriptHarness<AimScript> = createScriptHarness(AimScript, {
    components: [[Transform, transform]],
    services: [
      [InputApi, input],
      [CameraApi, camera],
    ],
  });

  harness.create();

  return { aim: harness.script, input, camera, transform };
}

describe("AimScript", () => {
  it("reports a zero angle before the first update", () => {
    const rig: Rig = createRig();

    expect(rig.aim.angle).toBe(0);
  });

  it("exposes the mouse direction after onUpdate", () => {
    const rig: Rig = createRig(Vec2.zero(), new Vec2(10, 10));

    rig.aim.onUpdate();

    expect(rig.aim.angle).toBeCloseTo(Math.PI / 4);
  });

  it("tracks a change of mouse position", () => {
    const rig: Rig = createRig(Vec2.zero(), new Vec2(10, 0));

    rig.aim.onUpdate();
    expect(rig.aim.angle).toBeCloseTo(0);

    rig.input.mousePosition = new Vec2(0, 5);
    rig.aim.onUpdate();
    expect(rig.aim.angle).toBeCloseTo(Math.PI / 2);

    rig.input.mousePosition = new Vec2(-5, 0);
    rig.aim.onUpdate();
    expect(rig.aim.angle).toBeCloseTo(Math.PI);
  });

  it("holds the last computed angle until the next update, rather than recomputing on read", () => {
    const rig: Rig = createRig(Vec2.zero(), new Vec2(10, 0));

    rig.aim.onUpdate();
    rig.input.mousePosition = new Vec2(0, 5);

    expect(rig.aim.angle).toBeCloseTo(0);

    rig.aim.onUpdate();

    expect(rig.aim.angle).toBeCloseTo(Math.PI / 2);
  });

  it("is exactly the value readAimAngle returns for the same inputs", () => {
    const rig: Rig = createRig(new Vec2(3, -7), new Vec2(21, 13));

    rig.aim.onUpdate();

    const expected: number = readAimAngle(
      rig.input,
      rig.camera,
      rig.transform.worldPosition,
    );

    expect(rig.aim.angle).toBe(expected);
  });

  it("takes its own transform world position as the aim origin", () => {
    const mousePosition: Vec2 = new Vec2(10, 10);

    const fromOrigin: Rig = createRig(Vec2.zero(), mousePosition);
    const fromOffset: Rig = createRig(new Vec2(10, 0), mousePosition);

    fromOrigin.aim.onUpdate();
    fromOffset.aim.onUpdate();

    expect(fromOrigin.aim.angle).toBeCloseTo(Math.PI / 4);
    expect(fromOffset.aim.angle).toBeCloseTo(Math.PI / 2);
  });
});
