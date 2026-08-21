import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";
import type { Prefab, ScriptContext } from "@atlasjs/gameplay";

import { MovementEmitterScript } from "../../../../src/game/scripts/player/MovementEmitterScript";
import { RunningAudioPlayerScript } from "../../../../src/game/scripts/player/RunningAudioPlayerScript";
import { RunningParticleSpawnerScript } from "../../../../src/game/scripts/player/RunningParticleSpawnerScript";
import type { RunningParticlePrefabProps } from "../../../../src/game/prefabs/fx/RunningParticlePrefab";

const DT: number = 0.1;
const OWNER: number = 7;

type InstantiateCall = { prefab: unknown; props: unknown };

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

class FakeContext {
  public readonly calls: InstantiateCall[] = [];

  public getEntityId(): number {
    return OWNER;
  }

  public instantiate(prefab: unknown, props?: unknown): unknown {
    this.calls.push({ prefab, props });
    return undefined;
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
  context: FakeContext;
  frame: () => void;
  frames: (count: number) => void;
};

function inject(script: object, fields: Record<string, unknown>): void {
  const target: Record<string, unknown> = script as Record<string, unknown>;

  for (const key of Object.keys(fields)) {
    target[key] = fields[key];
  }
}

function createRig<TScript extends MovementEmitterScript<object>>(
  script: TScript,
  extra: Record<string, unknown> = {},
): Rig<TScript> {
  const move: FakeVector2Action = new FakeVector2Action();
  const boost: FakeButtonAction = new FakeButtonAction();
  const context: FakeContext = new FakeContext();

  inject(script, { move, boost, ...extra });
  script.__bindContext(context as unknown as ScriptContext);

  const frame = (): void => script.onUpdate(DT);

  return {
    script,
    move,
    boost,
    context,
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
    const rig: Rig<CountingEmitter> = createRig(new CountingEmitter());

    rig.frames(50);

    expect(rig.script.emissions).toBe(0);
  });

  it("emits first exactly when the walk interval is reached, not before", () => {
    const rig: Rig<CountingEmitter> = createRig(new CountingEmitter());

    rig.move.set(1, 0);

    rig.frames(4);
    expect(rig.script.emissions).toBe(0);

    rig.frame();
    expect(rig.script.emissions).toBe(1);
  });

  it("resets the clock after an emission, so emissions stay periodic", () => {
    const rig: Rig<CountingEmitter> = createRig(new CountingEmitter());

    rig.move.set(0, 1);
    rig.frames(15);

    expect(rig.script.emissions).toBe(3);
  });

  it("uses the run interval while boost is down", () => {
    const rig: Rig<CountingEmitter> = createRig(new CountingEmitter());

    rig.move.set(1, 0);
    rig.boost.down = true;

    rig.frames(2);

    expect(rig.script.emissions).toBe(1);
  });

  it("uses the walk interval as soon as boost is released", () => {
    const rig: Rig<CountingEmitter> = createRig(new CountingEmitter());

    rig.move.set(1, 0);
    rig.frames(2);

    expect(rig.script.emissions).toBe(0);
  });

  it("drops a partial charge when movement stops", () => {
    const rig: Rig<CountingEmitter> = createRig(new CountingEmitter());

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
    const rig: Rig<CountingEmitter> = createRig(new CountingEmitter());

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
      new RunningParticleSpawnerScript(),
      {
        runningParticlePrefab: prefab,
        transform: { worldPosition },
      },
    );

    rig.move.set(1, 0);
    rig.frames(2);
    expect(rig.context.calls).toHaveLength(1);

    const call: InstantiateCall = rig.context.calls[0];
    const props: RunningParticlePrefabProps =
      call.props as RunningParticlePrefabProps;

    expect(call.prefab).toBe(prefab);
    expect(props.owner).toBe(OWNER);
    expect(props.position.x).toBe(12);
    expect(props.position.y).toBe(-5);
    expect(props.position).not.toBe(worldPosition);
  });

  it("keeps its 0.15s walk cadence", () => {
    const rig: Rig<RunningParticleSpawnerScript> = createRig(
      new RunningParticleSpawnerScript(),
      {
        runningParticlePrefab: {} as Prefab<RunningParticlePrefabProps>,
        transform: { worldPosition: Vec2.zero() },
      },
    );

    rig.move.set(1, 0);
    rig.frame();
    expect(rig.context.calls).toHaveLength(0);

    rig.frame();
    expect(rig.context.calls).toHaveLength(1);
  });
});

describe("RunningAudioPlayerScript emission", () => {
  it("hands the prefab nothing at all", () => {
    const prefab: Prefab = {} as Prefab;

    const rig: Rig<RunningAudioPlayerScript> = createRig(
      new RunningAudioPlayerScript(),
      { audioPrefab: prefab },
    );

    rig.move.set(1, 0);
    rig.frames(5);

    expect(rig.context.calls).toHaveLength(1);
    expect(rig.context.calls[0].prefab).toBe(prefab);
    expect(rig.context.calls[0].props).toBeUndefined();
  });

  it("keeps its 0.4s run cadence while boost is down", () => {
    const rig: Rig<RunningAudioPlayerScript> = createRig(
      new RunningAudioPlayerScript(),
      { audioPrefab: {} as Prefab },
    );

    rig.move.set(1, 0);
    rig.boost.down = true;

    rig.frames(3);
    expect(rig.context.calls).toHaveLength(0);

    rig.frame();
    expect(rig.context.calls).toHaveLength(1);
  });
});
