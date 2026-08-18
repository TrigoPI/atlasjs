import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";
import type { CameraApi, InputApi } from "@atlasjs/gameplay";

import { readAimAngle } from "../../../../src/game/scripts/weapon/aim";

function createInput(mousePosition: Vec2): InputApi {
  return { mousePosition } as unknown as InputApi;
}

function createCamera(worldPosition: Vec2): CameraApi {
  return {
    screenToWorld: (): Vec2 => worldPosition,
  } as unknown as CameraApi;
}

describe("readAimAngle", () => {
  it("returns 0 when the mouse world position is directly to the right of the origin", () => {
    const input: InputApi = createInput(new Vec2(1, 1));
    const camera: CameraApi = createCamera(new Vec2(10, 0));

    const angle: number = readAimAngle(input, camera, Vec2.zero());

    expect(angle).toBeCloseTo(0);
  });

  it("returns pi/2 when the mouse world position is above the origin", () => {
    const input: InputApi = createInput(new Vec2(1, 1));
    const camera: CameraApi = createCamera(new Vec2(0, 5));

    const angle: number = readAimAngle(input, camera, Vec2.zero());

    expect(angle).toBeCloseTo(Math.PI / 2);
  });

  it("returns -pi/2 when the mouse world position is below the origin", () => {
    const input: InputApi = createInput(new Vec2(1, 1));
    const camera: CameraApi = createCamera(new Vec2(0, -5));

    const angle: number = readAimAngle(input, camera, Vec2.zero());

    expect(angle).toBeCloseTo(-Math.PI / 2);
  });

  it("returns pi when the mouse world position is to the left of the origin", () => {
    const input: InputApi = createInput(new Vec2(1, 1));
    const camera: CameraApi = createCamera(new Vec2(-5, 0));

    const angle: number = readAimAngle(input, camera, Vec2.zero());

    expect(angle).toBeCloseTo(Math.PI);
  });

  it("subtracts the given origin, so the same mouse world position yields different angles for different origins", () => {
    const input: InputApi = createInput(new Vec2(1, 1));
    const camera: CameraApi = createCamera(new Vec2(10, 10));

    const angleFromZero: number = readAimAngle(input, camera, Vec2.zero());
    const angleFromOffsetOrigin: number = readAimAngle(
      input,
      camera,
      new Vec2(10, 0),
    );

    expect(angleFromZero).toBeCloseTo(Math.PI / 4);
    expect(angleFromOffsetOrigin).toBeCloseTo(Math.PI / 2);
    expect(angleFromZero).not.toBeCloseTo(angleFromOffsetOrigin);
  });

  it("calls screenToWorld with the mouse position provided by the input service", () => {
    const mouseScreenPos: Vec2 = new Vec2(12, 34);
    const calls: Vec2[] = [];

    const input: InputApi = {
      mousePosition: mouseScreenPos,
    } as unknown as InputApi;
    const camera: CameraApi = {
      screenToWorld: (screen: Vec2): Vec2 => {
        calls.push(screen);
        return screen;
      },
    } as unknown as CameraApi;

    readAimAngle(input, camera, Vec2.zero());

    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(mouseScreenPos);
  });
});
