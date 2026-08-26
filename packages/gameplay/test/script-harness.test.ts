import { describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import {
  AtlasScript,
  GameEntity,
  Prefab,
  ScriptMetadata,
  registerScriptMetadata,
} from "../src/scripting";

import {
  InstantiateRecord,
  ScriptHarness,
  StubScriptContext,
  createDetachedGameEntity,
  createScriptHarness,
  stubEntity,
} from "../src/testing";

class Knob {
  public value: number = 0;
}

class Tuned extends AtlasScript<{ scale?: number; label?: string }> {
  public scale: number = 3;
  public label: string = "default";
  public scaleAtCreate: number | undefined;

  public onCreate(): void {
    this.scaleAtCreate = this.scale;
  }
}
registerScriptMetadata(Tuned, {
  exposed: {
    scale: ScriptMetadata.field(),
    label: ScriptMetadata.field({ required: true }),
  },
});

class Pilot extends AtlasScript<{ target: GameEntity }> {
  public target!: GameEntity;
}
registerScriptMetadata(Pilot, {
  exposed: { target: ScriptMetadata.entity({ required: true }) },
});

class Reader extends AtlasScript {
  public knob: Knob | undefined;
  public owner: Entity | undefined;

  public onCreate(): void {
    this.knob = this.requireComponent(Knob);
    this.owner = this.entityId;
  }
}

class Spawner extends AtlasScript<{ prefab: Prefab<{ hp: number }> }> {
  public prefab!: Prefab<{ hp: number }>;

  public spawn(hp: number): void {
    this.instantiate(this.prefab, { hp });
  }
}
registerScriptMetadata(Spawner, {
  exposed: { prefab: ScriptMetadata.field({ required: true }) },
});

describe("createScriptHarness — prop injection", () => {
  it("leaves the class default in place when a prop is explicitly undefined", () => {
    const harness: ScriptHarness<Tuned> = createScriptHarness(Tuned, {
      props: { scale: undefined, label: "kept" },
    });

    expect(harness.script.scale).toBe(3);
    expect(harness.script.label).toBe("kept");
  });

  it("leaves the class default in place when the prop is absent", () => {
    const harness: ScriptHarness<Tuned> = createScriptHarness(Tuned, {
      props: { label: "kept" },
    });

    expect(harness.script.scale).toBe(3);
  });

  it("assigns a provided prop over the class default", () => {
    const harness: ScriptHarness<Tuned> = createScriptHarness(Tuned, {
      props: { scale: 11, label: "kept" },
    });

    expect(harness.script.scale).toBe(11);
  });

  it("injects before onCreate runs, as attach does", () => {
    const harness: ScriptHarness<Tuned> = createScriptHarness(Tuned, {
      props: { scale: 7, label: "kept" },
    });

    harness.create();

    expect(harness.script.scaleAtCreate).toBe(7);
  });

  it("stays silent on a missing required prop that has a class default", () => {
    const harness: ScriptHarness<Tuned> = createScriptHarness(Tuned, {
      props: { scale: 2 },
    });

    expect(harness.warnings).toHaveLength(0);
    expect(harness.script.label).toBe("default");
  });

  it("warns when a required prop has no value and no class default", () => {
    const harness: ScriptHarness<Pilot> = createScriptHarness(Pilot, {});

    expect(harness.warnings).toHaveLength(1);
    expect(harness.warnings[0]).toContain("target");
  });

  it("warns about a prop that is not exposed", () => {
    const harness: ScriptHarness<Tuned> = createScriptHarness(Tuned, {
      // @ts-expect-error — "ghost" is not part of the declared props
      props: { label: "kept", ghost: 1 },
    });

    expect(harness.warnings).toHaveLength(1);
    expect(harness.warnings[0]).toContain("ghost");
  });
});

describe("createScriptHarness — entity props", () => {
  it("hands the script a GameEntity, not the raw Entity", () => {
    const target: Entity = stubEntity(42);
    const harness: ScriptHarness<Pilot> = createScriptHarness(Pilot, {
      props: { target },
    });

    expect(typeof harness.script.target).toBe("object");
    expect(harness.script.target.id).toBe(target);
    expect(harness.warnings).toHaveLength(0);
  });

  it("routes the wrapping through the context, so wrapEntity is honoured", () => {
    const seen: Entity[] = [];
    const handle: GameEntity = createDetachedGameEntity(stubEntity(9));

    const harness: ScriptHarness<Pilot> = createScriptHarness(Pilot, {
      props: { target: stubEntity(42) },
      wrapEntity: (entity: Entity): GameEntity => {
        seen.push(entity);
        return handle;
      },
    });

    expect(seen).toEqual([42]);
    expect(harness.script.target).toBe(handle);
  });
});

describe("createScriptHarness — context tables", () => {
  it("serves components and the entity id to onCreate", () => {
    const knob: Knob = new Knob();
    const harness: ScriptHarness<Reader> = createScriptHarness(Reader, {
      entityId: stubEntity(7),
      components: [[Knob, knob]],
    });

    harness.create();

    expect(harness.script.knob).toBe(knob);
    expect(harness.script.owner).toBe(7);
  });

  it("lets requireComponent throw its real error on a missing component", () => {
    const harness: ScriptHarness<Reader> = createScriptHarness(Reader);

    expect(() => harness.create()).toThrow(/Required component "Knob"/);
  });

  it("journals instantiate calls", () => {
    const prefab: Prefab<{ hp: number }> = {
      build: (): void => {},
    };

    const harness: ScriptHarness<Spawner> = createScriptHarness(Spawner, {
      props: { prefab },
    });

    harness.script.spawn(5);
    harness.script.spawn(9);

    const calls: readonly InstantiateRecord[] = harness.instantiations;

    expect(calls).toHaveLength(2);
    expect(calls[0].prefab).toBe(prefab);
    expect(calls[0].params).toEqual({ hp: 5 });
    expect(calls[1].params).toEqual({ hp: 9 });
  });

  it("applies field overrides for internals that are not exposed props", () => {
    const harness: ScriptHarness<Tuned> = createScriptHarness(Tuned, {
      props: { label: "kept" },
      fields: { scaleAtCreate: 99 },
    });

    expect(harness.script.scaleAtCreate).toBe(99);
    expect(harness.warnings).toHaveLength(0);
  });
});

describe("StubScriptContext", () => {
  it("throws an actionable error when a service is not registered", () => {
    const context: StubScriptContext = new StubScriptContext();

    expect(() => context.getService(FakeFacade)).toThrow(/FakeFacade/);
  });

  it("returns a service registered with the value undefined", () => {
    const context: StubScriptContext = new StubScriptContext({
      services: [[FakeFacade, undefined]],
    });

    expect(context.getService(FakeFacade)).toBeUndefined();
  });

  it("counts destroy calls instead of touching a world", () => {
    const context: StubScriptContext = new StubScriptContext();

    context.destroy();
    context.destroy();

    expect(context.destroyCalls).toBe(2);
  });
});

class FakeFacade {
  public static readonly token: symbol = Symbol("FakeFacade");
}
