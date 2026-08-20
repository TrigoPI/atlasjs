import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";
import { NebulaRenderer } from "@atlasjs/nebula";

import { CameraManager } from "../src/camera/CameraManager";
import { ShakePresets, ShakeSpec } from "../src/camera/shake";

function spec(strength: number): ShakeSpec {
  return { ...ShakePresets.medium, strength };
}

function createManager(): CameraManager {
  return new CameraManager({} as unknown as NebulaRenderer);
}

function settle(manager: CameraManager, seconds: number): void {
  const step: number = 1 / 120;

  for (let t: number = 0; t < seconds; t += step) {
    manager.advanceShake(step);
  }
}

describe("CameraManager shake", () => {
  it("rests at the origin until something shakes it", () => {
    const manager: CameraManager = createManager();

    settle(manager, 0.5);

    expect(manager.getShakeOffset().x).toBe(0);
    expect(manager.getShakeOffset().y).toBe(0);
  });

  it("kicks the camera along the given direction", () => {
    const manager: CameraManager = createManager();

    manager.shake(spec(20), new Vec2(1, 0));
    manager.advanceShake(1 / 120);

    expect(manager.getShakeOffset().x).toBeGreaterThan(0);
    expect(manager.getShakeOffset().y).toBeCloseTo(0);
  });

  it("kicks the other way for the opposite direction", () => {
    const manager: CameraManager = createManager();

    manager.shake(spec(20), new Vec2(-1, 0));
    manager.advanceShake(1 / 120);

    expect(manager.getShakeOffset().x).toBeLessThan(0);
  });

  it("normalises the direction so only strength sets the amplitude", () => {
    const short: CameraManager = createManager();
    const long: CameraManager = createManager();

    short.shake(spec(20), new Vec2(1, 0));
    long.shake(spec(20), new Vec2(500, 0));
    short.advanceShake(1 / 120);
    long.advanceShake(1 / 120);

    expect(long.getShakeOffset().x).toBeCloseTo(short.getShakeOffset().x);
  });

  it("comes back to rest on its own", () => {
    const manager: CameraManager = createManager();

    manager.shake(spec(30), new Vec2(1, 0.5));
    settle(manager, 1.5);

    expect(manager.getShakeOffset().x).toBe(0);
    expect(manager.getShakeOffset().y).toBe(0);
  });

  it("stays bounded when a frame takes far longer than the spring step", () => {
    const manager: CameraManager = createManager();

    manager.shake(spec(30), new Vec2(1, 0));

    // 4 fps: far past the explicit integrator's stability limit.
    for (let i: number = 0; i < 40; i++) {
      manager.advanceShake(0.25);
    }

    expect(Number.isFinite(manager.getShakeOffset().x)).toBe(true);
    expect(manager.getShakeOffset().mag()).toBeLessThan(1);
  });

  it("settles to the same place whatever the frame rate", () => {
    const smooth: CameraManager = createManager();
    const choppy: CameraManager = createManager();

    smooth.shake(spec(30), new Vec2(1, 0));
    choppy.shake(spec(30), new Vec2(1, 0));

    for (let i: number = 0; i < 240; i++) {
      smooth.advanceShake(1 / 240);
    }

    for (let i: number = 0; i < 4; i++) {
      choppy.advanceShake(0.25);
    }

    expect(smooth.getShakeOffset().mag()).toBeLessThan(1);
    expect(choppy.getShakeOffset().mag()).toBeLessThan(1);
  });

  it("stays stable for every preset, even at a crawling frame rate", () => {
    for (const preset of Object.values(ShakePresets)) {
      const manager: CameraManager = createManager();

      manager.shake(preset, new Vec2(1, 0));

      for (let i: number = 0; i < 60; i++) {
        manager.advanceShake(0.25);
      }

      expect(Number.isFinite(manager.getShakeOffset().x)).toBe(true);
      expect(manager.getShakeOffset().mag()).toBeLessThan(1);
    }
  });

  it("rings longer for a loose preset than for a tight one", () => {
    const tight: CameraManager = createManager();
    const loose: CameraManager = createManager();

    tight.shake(ShakePresets.light, new Vec2(1, 0));
    loose.shake(ShakePresets.rumble, new Vec2(1, 0));

    settle(tight, 0.35);
    settle(loose, 0.35);

    expect(loose.getShakeOffset().mag()).toBeGreaterThan(
      tight.getShakeOffset().mag(),
    );
  });

  it("takes the strength from the spec it was handed", () => {
    const soft: CameraManager = createManager();
    const hard: CameraManager = createManager();

    soft.shake(spec(20), new Vec2(1, 0));
    hard.shake({ ...ShakePresets.medium, strength: 200 }, new Vec2(1, 0));
    soft.advanceShake(1 / 120);
    hard.advanceShake(1 / 120);

    expect(hard.getShakeOffset().x).toBeGreaterThan(soft.getShakeOffset().x);
  });

  it("refuses a spec with a non-positive stiffness", () => {
    const manager: CameraManager = createManager();

    manager.shake({ strength: 50, stiffness: 0, damping: 20 }, new Vec2(1, 0));
    manager.advanceShake(1 / 120);

    expect(manager.getShakeOffset().x).toBe(0);
  });

  it("ignores a zero or negative strength", () => {
    const manager: CameraManager = createManager();

    manager.shake(spec(0), new Vec2(1, 0));
    manager.shake(spec(-5), new Vec2(1, 0));
    manager.advanceShake(1 / 120);

    expect(manager.getShakeOffset().x).toBe(0);
  });

  it("falls back to a vertical kick for a zero-length direction", () => {
    const manager: CameraManager = createManager();

    manager.shake(spec(20), new Vec2(0, 0));
    manager.advanceShake(1 / 120);

    expect(manager.getShakeOffset().y).toBeGreaterThan(0);
    expect(Number.isNaN(manager.getShakeOffset().x)).toBe(false);
  });
});
