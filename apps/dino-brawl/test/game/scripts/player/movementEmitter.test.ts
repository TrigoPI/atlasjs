import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";
import { PlayerInput, Transform } from "@atlasjs/gameplay";
import type { Prefab, ScriptConstructor } from "@atlasjs/gameplay";
import { createScriptHarness, stubEntity } from "@atlasjs/gameplay/testing";
import type {
  InstantiateRecord,
  ScriptHarness,
  ScriptHarnessOptions,
} from "@atlasjs/gameplay/testing";

import { MovementEmitterScript } from "../../../../src/game/scripts/player/MovementEmitterScript";
import { RunningAudioPlayerScript } from "../../../../src/game/scripts/player/RunningAudioPlayerScript";
import { RunningParticleSpawnerScript } from "../../../../src/game/scripts/player/RunningParticleSpawnerScript";
import type { RunningParticlePrefabProps } from "../../../../src/game/prefabs/fx/RunningParticlePrefab";

const DT: number = 0.1;
const OWNER: number = 7;

class FakeVector2Action {
  private value: Vec2 = Vec2.zero();

  public set(x: number, y: number): void {
    this.value = new Vec2(x, y);
  }

  public readValue(): Vec2 {
    return this.value;
  }
}

class FakeButtonAction {
  public down: boolean = false;

  public isDown(): boolean {
    return this.down;
  }
}

class FakePlayerInput {
  private readonly actions: Record<string, unknown>;

  public constructor(actions: Record<string, unknown>) {
    this.actions = actions;
  }

  public get(name: string): unknown {
    return this.actions[name];
  }
}

class CountingEmitter extends MovementEmitterScript {
  public emissions: number = 0;

  protected override walkInterval: number = 0.5;
  protected override runInterval: number = 0.2;

  protected emit(): void {
    this.emissions += 1;
  }
}

type Rig<TScript> = {
  script: TScript;
  move: FakeVector2Action;
  boost: FakeButtonAction;
  instantiations: readonly InstantiateRecord[];
  frame: () => void;
  frames: (count: number) => void;
};

function createRig<TScript extends MovementEmitterScript<object>>(
  ScriptType: ScriptConstructor<TScript>,
  options: ScriptHarnessOptions<TScript> = {},
): Rig<TScript> {
  const move: FakeVector2Action = new FakeVector2Action();
  const boost: FakeButtonAction = new FakeButtonAction();

  const harness: ScriptHarness<TScript> = createScriptHarness(ScriptType, {
    ...options,
    entityId: stubEntity(OWNER),
    components: [
      [PlayerInput, new FakePlayerInput({ move, boost })],
      ...(options.components ?? []),
    ],
  });

  harness.create();

  const frame = (): void => harness.script.onUpdate(DT);

  return {
    script: harness.script,
    move,
    boost,
    instantiations: harness.instantiations,
    frame,
    frames: (count: number): void => {
      for (let i: number = 0; i < count; i++) {
        frame();
      }
    },
  };
}

describe("MovementEmitterScript timing", () => {
  it("never emits while the movement vector is zero", () => {
    const rig: Rig<CountingEmitter> = createRig(CountingEmitter);

    rig.frames(50);

    expect(rig.script.emissions).toBe(0);
  });

  it("emits first exactly when the walk interval is reached, not before", () => {
    const rig: Rig<CountingEmitter> = createRig(CountingEmitter);

    rig.move.set(1, 0);

    rig.frames(4);
    expect(rig.script.emissions).toBe(0);

    rig.frame();
    expect(rig.script.emissions).toBe(1);
  });

  it("resets the clock after an emission, so emissions stay periodic", () => {
    const rig: Rig<CountingEmitter> = createRig(CountingEmitter);

    rig.move.set(0, 1);
    rig.frames(15);

    expect(rig.script.emissions).toBe(3);
  });

  it("uses the run interval while boost is down", () => {
    const rig: Rig<CountingEmitter> = createRig(CountingEmitter);

    rig.move.set(1, 0);
    rig.boost.down = true;

    rig.frames(2);

    expect(rig.script.emissions).toBe(1);
  });

  it("uses the walk interval as soon as boost is released", () => {
    const rig: Rig<CountingEmitter> = createRig(CountingEmitter);

    rig.move.set(1, 0);
    rig.frames(2);

    expect(rig.script.emissions).toBe(0);
  });

  it("drops a partial charge when movement stops", () => {
    const rig: Rig<CountingEmitter> = createRig(CountingEmitter);

    rig.move.set(1, 0);
    rig.frames(4);

    rig.move.set(0, 0);
    rig.frame();

    rig.move.set(1, 0);
    rig.frames(4);
    expect(rig.script.emissions).toBe(0);

    rig.frame();
    expect(rig.script.emissions).toBe(1);
  });

  it("emits on schedule on a fresh instance that was never idle first", () => {
    const rig: Rig<CountingEmitter> = createRig(CountingEmitter);

    rig.move.set(1, 0);
    rig.frames(5);

    expect(rig.script.emissions).toBe(1);
  });
});

describe("RunningParticleSpawnerScript emission", () => {
  it("hands the prefab a cloned world position and the owner id", () => {
    const prefab: Prefab<RunningParticlePrefabProps> =
      {} as Prefab<RunningParticlePrefabProps>;
    const worldPosition: Vec2 = new Vec2(12, -5);

    const rig: Rig<RunningParticleSpawnerScript> = createRig(
      RunningParticleSpawnerScript,
      {
        props: { runningParticlePrefab: prefab },
        components: [[Transform, { worldPosition }]],
      },
    );

    rig.move.set(1, 0);
    rig.frames(2);
    expect(rig.instantiations).toHaveLength(1);

    const call: InstantiateRecord = rig.instantiations[0];
    const props: RunningParticlePrefabProps =
      call.params as RunningParticlePrefabProps;

    expect(call.prefab).toBe(prefab);
    expect(props.owner).toBe(OWNER);
    expect(props.position.x).toBe(12);
    expect(props.position.y).toBe(-5);
    expect(props.position).not.toBe(worldPosition);
  });

  it("keeps its 0.15s walk cadence", () => {
    const rig: Rig<RunningParticleSpawnerScript> = createRig(
      RunningParticleSpawnerScript,
      {
        props: {
          runningParticlePrefab: {} as Prefab<RunningParticlePrefabProps>,
        },
        components: [[Transform, { worldPosition: Vec2.zero() }]],
      },
    );

    rig.move.set(1, 0);
    rig.frame();
    expect(rig.instantiations).toHaveLength(0);

    rig.frame();
    expect(rig.instantiations).toHaveLength(1);
  });
});

describe("RunningAudioPlayerScript emission", () => {
  it("hands the prefab nothing at all", () => {
    const prefab: Prefab = {} as Prefab;

    const rig: Rig<RunningAudioPlayerScript> = createRig(
      RunningAudioPlayerScript,
      { props: { audioPrefab: prefab } },
    );

    rig.move.set(1, 0);
    rig.frames(5);

    expect(rig.instantiations).toHaveLength(1);
    expect(rig.instantiations[0].prefab).toBe(prefab);
    expect(rig.instantiations[0].params).toBeUndefined();
  });

  it("keeps its 0.4s run cadence while boost is down", () => {
    const rig: Rig<RunningAudioPlayerScript> = createRig(
      RunningAudioPlayerScript,
      { props: { audioPrefab: {} as Prefab } },
    );

    rig.move.set(1, 0);
    rig.boost.down = true;

    rig.frames(3);
    expect(rig.instantiations).toHaveLength(0);

    rig.frame();
    expect(rig.instantiations).toHaveLength(1);
  });
});
