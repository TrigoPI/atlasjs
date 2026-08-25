import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";
import {
  AfterimageRenderer,
  Color,
  type EntityBuilder,
  type Prefab,
} from "@atlasjs/gameplay";
import type { AudioClip } from "@atlasjs/audio";

import {
  createPlayerPrefab,
  type PlayerPrefabProps,
} from "../../../src/game/prefabs/player/PlayerPrefab";
import { PlayerAnimationScript } from "../../../src/game/scripts/player/PlayerAnimationScript";
import { PlayerDashScript } from "../../../src/game/scripts/player/PlayerDashScript";
import { PlayerMovementScript } from "../../../src/game/scripts/player/PlayerMovementScript";

type AddCall = { type: unknown; args: unknown[] };
type AttachCall = { script: unknown; props: unknown };

class FakeBuilder {
  public readonly entity: number = 1;
  public readonly adds: AddCall[] = [];
  public readonly attaches: AttachCall[] = [];

  public readonly addResults: unknown[] = [];
  public readonly attachResults: unknown[] = [];

  public add(type: unknown, ...args: unknown[]): unknown {
    this.adds.push({ type, args });
    const result: object = {
      position: new Vec2(),
      scale: new Vec2(),
      offset: new Vec2(),
    };
    this.addResults.push(result);
    return result;
  }

  public attach(script: unknown, props?: unknown): unknown {
    this.attaches.push({ script, props });
    const result: object = {};
    this.attachResults.push(result);
    return result;
  }

  public child(build: (entity: EntityBuilder) => void): EntityBuilder {
    const child: FakeBuilder = new FakeBuilder();
    build(child as unknown as EntityBuilder);
    return child as unknown as EntityBuilder;
  }
}

type Rig = {
  builder: FakeBuilder;
  clip: AudioClip;
};

function createRig(): Rig {
  const clip: AudioClip = { id: "woosh" } as unknown as AudioClip;

  const prefab: Prefab<PlayerPrefabProps> = createPlayerPrefab({
    runningAudioPrefab: { build: (): void => {} },
    runningParticlePrefab: { build: (): void => {} } as never,
    dashWooshClip: clip,
  });

  const builder: FakeBuilder = new FakeBuilder();

  prefab.build(builder as unknown as EntityBuilder, {
    position: new Vec2(0, 0),
    sprite: {} as never,
    clips: {},
  });

  return { builder, clip };
}

function findAdd(builder: FakeBuilder, type: unknown): AddCall {
  const call: AddCall | undefined = builder.adds.find(
    (c: AddCall): boolean => c.type === type,
  );

  if (call === undefined) {
    throw new Error("expected add call not found");
  }

  return call;
}

function findAttach(builder: FakeBuilder, script: unknown): AttachCall {
  const call: AttachCall | undefined = builder.attaches.find(
    (c: AttachCall): boolean => c.script === script,
  );

  if (call === undefined) {
    throw new Error("expected attach call not found");
  }

  return call;
}

describe("PlayerPrefab composition", () => {
  it("adds the AfterimageRenderer with the tuned trail values", () => {
    const { builder }: Rig = createRig();

    const afterimage: AddCall = findAdd(builder, AfterimageRenderer);

    expect(afterimage.args[0]).toEqual({
      interval: 0.04,
      time: 0.22,
      startColor: new Color(1, 1, 1, 0.45),
      endColor: new Color(1, 1, 1, 0),
      emitting: false,
      maxImages: 8,
      sortingLayer: "Entities",
      sortingOrder: 7,
    });
  });

  it("attaches PlayerDashScript before PlayerAnimationScript and PlayerMovementScript", () => {
    const { builder }: Rig = createRig();

    const order: unknown[] = builder.attaches.map(
      (c: AttachCall): unknown => c.script,
    );

    const dashIndex: number = order.indexOf(PlayerDashScript);
    const animationIndex: number = order.indexOf(PlayerAnimationScript);
    const movementIndex: number = order.indexOf(PlayerMovementScript);

    expect(dashIndex).toBeGreaterThanOrEqual(0);
    expect(dashIndex).toBeLessThan(animationIndex);
    expect(dashIndex).toBeLessThan(movementIndex);
  });

  it("injects the same dash instance into PlayerAnimationScript and PlayerMovementScript", () => {
    const { builder }: Rig = createRig();

    const dashAttachIndex: number = builder.attaches.indexOf(
      findAttach(builder, PlayerDashScript),
    );
    const dashInstance: unknown = builder.attachResults[dashAttachIndex];

    const animationProps: { dash: unknown } = findAttach(
      builder,
      PlayerAnimationScript,
    ).props as { dash: unknown };

    const movementProps: { dash: unknown } = findAttach(
      builder,
      PlayerMovementScript,
    ).props as { dash: unknown };

    expect(animationProps.dash).toBe(dashInstance);
    expect(movementProps.dash).toBe(dashInstance);
  });

  it("injects the same AfterimageRenderer instance it added as the dash's afterimages prop", () => {
    const { builder }: Rig = createRig();

    const afterimageAddIndex: number = builder.adds.findIndex(
      (c: AddCall): boolean => c.type === AfterimageRenderer,
    );
    const afterimageResult: unknown = builder.addResults[afterimageAddIndex];

    const dashProps: { afterimages: unknown } = findAttach(
      builder,
      PlayerDashScript,
    ).props as { afterimages: unknown };

    expect(dashProps.afterimages).toBe(afterimageResult);
  });

  it("passes the dash woosh clip to PlayerDashScript", () => {
    const { builder, clip }: Rig = createRig();

    const dashProps: { woosh: unknown } = findAttach(builder, PlayerDashScript)
      .props as { woosh: unknown };

    expect(dashProps.woosh).toBe(clip);
  });
});
