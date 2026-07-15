import { beforeEach, describe, expect, it } from "vitest";

import { ServiceRegistry } from "@atlasjs/core";
import { Vec2 } from "@atlasjs/math";
import { Input as InputService, INPUT, Key } from "@atlasjs/input";

import { InputApi } from "../src/scripting";

class FakeInput {
  public readonly downKeys: Set<string> = new Set<string>();
  public readonly pressedKeys: Set<string> = new Set<string>();
  public readonly releasedKeys: Set<string> = new Set<string>();

  public readonly pointer = {
    position: new Vec2(10, 20),
    delta: new Vec2(1, 2),
    wheelDelta: 3,
    down: false,
    pressed: false,
    released: false,
  };

  public isDown(code: string): boolean {
    return this.downKeys.has(code);
  }

  public isPressed(code: string): boolean {
    return this.pressedKeys.has(code);
  }

  public isReleased(code: string): boolean {
    return this.releasedKeys.has(code);
  }

  public endFrame(): void {}
}

describe("Gameplay — InputApi façade", () => {
  let backend: FakeInput;
  let input: InputApi;

  beforeEach(() => {
    backend = new FakeInput();
    const services: ServiceRegistry = new ServiceRegistry();
    services.provide(INPUT, backend as unknown as InputService);
    input = new InputApi(services);
  });

  it("delegates isDown/isPressed/isReleased with the Key code", () => {
    backend.downKeys.add(Key.D);
    backend.pressedKeys.add(Key.Space);
    backend.releasedKeys.add(Key.A);

    expect(input.isDown(Key.D)).toBe(true);
    expect(input.isDown(Key.A)).toBe(false);
    expect(input.isPressed(Key.Space)).toBe(true);
    expect(input.isPressed(Key.D)).toBe(false);
    expect(input.isReleased(Key.A)).toBe(true);
    expect(input.isReleased(Key.Space)).toBe(false);
  });

  it("routes mouse buttons through the Key codes", () => {
    backend.downKeys.add(Key.MouseLeft);

    expect(input.isDown(Key.MouseLeft)).toBe(true);
    expect(input.isDown(Key.MouseRight)).toBe(false);
  });

  it("exposes the pointer position/delta/scroll", () => {
    expect(input.mousePosition.x).toBe(10);
    expect(input.mousePosition.y).toBe(20);
    expect(input.mouseDelta.x).toBe(1);
    expect(input.mouseDelta.y).toBe(2);
    expect(input.scrollDelta).toBe(3);
  });
});
