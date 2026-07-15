import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";
import {
  ButtonAction,
  Input,
  INPUT,
  Key,
  Vector2Action,
  button,
  defineActions,
  vector2,
} from "@atlasjs/input";

import { PlayerInput } from "../src/components";
import { createHarness, Harness } from "./helpers/harness";

class FakeInput {
  public readonly downKeys: Set<string> = new Set<string>();

  public isDown(code: string): boolean {
    return this.downKeys.has(code);
  }

  public isPressed(): boolean {
    return false;
  }

  public isReleased(): boolean {
    return false;
  }

  public endFrame(): void {}
}

describe("Gameplay — PlayerInput + PlayerInputSystem", () => {
  let h: Harness;
  let backend: FakeInput;

  beforeEach(async () => {
    h = await createHarness();
    backend = new FakeInput();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("samples each entity's actions every frame", () => {
    h.services.provide(INPUT, backend as unknown as Input);

    const e: Entity = h.world.createEntity();
    const pi = h.world.addComponent(
      e,
      PlayerInput,
      defineActions({
        jump: button().keys(Key.Space),
        move: vector2().wasd(),
      }),
    );
    const jump: ButtonAction = pi.get("jump");
    const move: Vector2Action = pi.get("move");

    backend.downKeys.add(Key.Space);
    backend.downKeys.add(Key.D);
    h.frame();

    expect(jump.isDown()).toBe(true);
    expect(jump.isPressed()).toBe(true);
    expect(move.x).toBe(1);
    expect(move.y).toBe(0);
  });

  it("keeps two PlayerInput entities independent", () => {
    h.services.provide(INPUT, backend as unknown as Input);

    const e1: Entity = h.world.createEntity();
    const e2: Entity = h.world.createEntity();
    const p1 = h.world.addComponent(
      e1,
      PlayerInput,
      defineActions({ fire: button().keys(Key.A) }),
    );
    const p2 = h.world.addComponent(
      e2,
      PlayerInput,
      defineActions({ fire: button().keys(Key.L) }),
    );

    backend.downKeys.add(Key.A);
    h.frame();

    expect(p1.get("fire").isDown()).toBe(true);
    expect(p2.get("fire").isDown()).toBe(false);
  });

  it("throws when a PlayerInput exists but the Input service is absent", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(
      e,
      PlayerInput,
      defineActions({ jump: button().keys(Key.Space) }),
    );

    expect(() => h.frame()).toThrow(/Service not found/);
  });

  it("does nothing (no INPUT resolution) when there is no PlayerInput entity", () => {
    expect(() => h.frame()).not.toThrow();
  });
});
