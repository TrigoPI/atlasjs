import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";
import type { AudioClip } from "@atlasjs/audio";
import type { EntityBuilder, Prefab } from "@atlasjs/gameplay";

import {
  createEnemyPrefab,
  type EnemyPrefabProps,
} from "../../../src/game/prefabs/enemy/EnemyPrefab";
import { HurtboxScript } from "../../../src/game/scripts/combat/HurtboxScript";

type AddCall = { type: unknown; args: unknown[] };
type AttachCall = { script: unknown; props: unknown };

class FakeBuilder {
  public readonly entity: number;
  public readonly adds: AddCall[] = [];
  public readonly attaches: AttachCall[] = [];
  public readonly children: FakeBuilder[] = [];

  private nextChildEntity: number;

  public constructor(entity: number, nextChildEntity: number) {
    this.entity = entity;
    this.nextChildEntity = nextChildEntity;
  }

  public add(type: unknown, ...args: unknown[]): unknown {
    this.adds.push({ type, args });

    return {
      position: new Vec2(),
      scale: new Vec2(),
      offset: new Vec2(),
    };
  }

  public attach(script: unknown, props?: unknown): unknown {
    this.attaches.push({ script, props });

    return {};
  }

  public child(build: (entity: EntityBuilder) => void): EntityBuilder {
    const child: FakeBuilder = new FakeBuilder(
      this.nextChildEntity,
      this.nextChildEntity + 1,
    );

    this.children.push(child);
    build(child as unknown as EntityBuilder);

    return child as unknown as EntityBuilder;
  }
}

function createRig(): FakeBuilder {
  const prefab: Prefab<EnemyPrefabProps> = createEnemyPrefab();
  const builder: FakeBuilder = new FakeBuilder(1, 2);

  prefab.build(builder as unknown as EntityBuilder, {
    position: new Vec2(0, 0),
    sprite: {} as never,
    hitClip: {} as unknown as AudioClip,
    clips: {},
    impactPrefab: { build: (): void => {} } as never,
  });

  return builder;
}

describe("createEnemyPrefab", () => {
  it("gives the child hurtbox the root entity as its owner", () => {
    const builder: FakeBuilder = createRig();
    const child: FakeBuilder = builder.children[0];

    const hurtboxAttach: AttachCall | undefined = child.attaches.find(
      (attached: AttachCall) => attached.script === HurtboxScript,
    );

    expect(
      (hurtboxAttach?.props as { owner?: unknown } | undefined)?.owner,
    ).toBe(builder.entity);
  });
});
