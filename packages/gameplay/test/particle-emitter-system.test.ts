import { describe, expect, it, vi } from "vitest";
import { Bound, Transform2D, Vec4 } from "@atlasjs/math";
import {
  CPUParticleNode,
  NebulaRenderer,
  SceneGraph,
  Sprite,
} from "@atlasjs/nebula";
import type { ParticleEmitterConfig, Texture2D } from "@atlasjs/nebula";
import type { TimeControl } from "@atlasjs/core";
import { Entity, NexusWorld } from "@atlasjs/nexus";
import {
  ParticleEmitter,
  TimeScale,
  WorldTransform2D,
} from "../src/components";
import type { ParticleEmitterOptions } from "../src/components";
import { ParticleEmitterSystem } from "../src/systems";
import { SortingLayers } from "../src/rendering";
import { TimeScaleManager } from "../src/time";
import { fakeTexture } from "./helpers/fakes";

const DT: number = 1 / 60;

interface Rig {
  world: NexusWorld;
  scene: SceneGraph;
  layers: SortingLayers;
  timeScale: TimeScaleManager;
  system: ParticleEmitterSystem;
}

function still(overrides: ParticleEmitterConfig = {}): ParticleEmitterConfig {
  return {
    rate: 0,
    startSpeed: 0,
    startSize: 1,
    startLifetime: 1,
    duration: 1000,
    looping: false,
    maxParticles: 64,
    ...overrides,
  };
}

function setup(withTimeScale: boolean = true): Rig {
  const world: NexusWorld = new NexusWorld();
  world
    .defineComponent(WorldTransform2D)
    .defineComponent(ParticleEmitter)
    .defineComponent(TimeScale);

  const scene: SceneGraph = new SceneGraph();
  const nebula: NebulaRenderer = { scene } as unknown as NebulaRenderer;
  const layers: SortingLayers = new SortingLayers().define([
    { name: "Entities", mode: "ySorted" },
  ]);
  const time: TimeControl = { scale: 1 } as unknown as TimeControl;
  const timeScale: TimeScaleManager = new TimeScaleManager(world, time);

  return {
    world,
    scene,
    layers,
    timeScale,
    system: new ParticleEmitterSystem(
      nebula,
      layers,
      withTimeScale ? timeScale : undefined,
    ),
  };
}

function mount(
  world: NexusWorld,
  options: ParticleEmitterOptions,
  x: number = 0,
  y: number = 0,
): Entity {
  const entity: Entity = world.createEntity();
  const transform: Transform2D = new Transform2D();
  transform.position.set(x, y);
  world
    .addComponent(entity, WorldTransform2D)
    .matrix.fromTransform2D(transform);
  world.addComponent(entity, ParticleEmitter, options);
  return entity;
}

function moveTo(
  world: NexusWorld,
  entity: Entity,
  x: number,
  y: number,
  rotation: number = 0,
  scaleX: number = 1,
  scaleY: number = 1,
): void {
  const transform: Transform2D = new Transform2D();
  transform.position.set(x, y);
  transform.scale.set(scaleX, scaleY);
  transform.rotation = rotation;
  world
    .requireComponent(entity, WorldTransform2D)
    .matrix.fromTransform2D(transform);
}

function nodeOf(scene: SceneGraph): CPUParticleNode {
  return scene.root.getChildren()[0] as CPUParticleNode;
}

function emitterOf(world: NexusWorld, entity: Entity): ParticleEmitter {
  return world.requireComponent(entity, ParticleEmitter);
}

function atlas(): Texture2D {
  return fakeTexture("atlas", 64, 32);
}

describe("ParticleEmitterSystem mounting", () => {
  it("mounts a CPUParticleNode into the scene on the first update", () => {
    const { world, scene, system } = setup();
    mount(world, { config: still() });

    expect(scene.root.getChildren()).toHaveLength(0);

    system.update({ world, dt: DT });

    expect(scene.root.getChildren()).toHaveLength(1);
    expect(nodeOf(scene)).toBeInstanceOf(CPUParticleNode);
  });

  it("honours an initial playing state at mount without any explicit play call", () => {
    const { world, scene, system } = setup();
    mount(world, { config: still({ bursts: [{ time: 0, count: 3 }] }) });

    system.update({ world, dt: DT });

    const node: CPUParticleNode = nodeOf(scene);
    expect(node.state).toBe("playing");
    expect(node.aliveCount).toBe(3);
  });

  it("leaves a playOnAwake: false emitter stopped and empty", () => {
    const { world, scene, system } = setup();
    mount(world, {
      config: still({ bursts: [{ time: 0, count: 3 }] }),
      playOnAwake: false,
    });

    system.update({ world, dt: DT });

    const node: CPUParticleNode = nodeOf(scene);
    expect(node.state).toBe("stopped");
    expect(node.aliveCount).toBe(0);
  });

  it("propagates blend, visible and the sort fields onto the node", () => {
    const { world, scene, layers, system } = setup();
    mount(
      world,
      {
        config: still(),
        blend: "additive",
        visible: false,
        sortingLayer: "Entities",
        sortingOrder: 7,
      },
      0,
      42,
    );

    system.update({ world, dt: DT });

    const node: CPUParticleNode = nodeOf(scene);
    expect(node.blend).toBe("additive");
    expect(node.visible).toBe(false);
    expect(node.sortingLayer).toBe(layers.indexOf("Entities"));
    expect(node.sortPrimary).toBe(42);
    expect(node.sortSecondary).toBe(7);
  });
});

describe("ParticleEmitterSystem config push", () => {
  it("applies a config replaced by reference", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, { config: still() });

    system.update({ world, dt: DT });
    expect(nodeOf(scene).gravity.y).toBe(0);

    emitterOf(world, entity).setConfig(still({ gravity: { x: 0, y: -250 } }));
    system.update({ world, dt: DT });

    expect(nodeOf(scene).gravity.y).toBe(-250);
  });

  it("does not re-apply an unchanged config across frames", () => {
    const { world, system } = setup();
    const entity: Entity = mount(world, { config: still() });
    const spy = vi.spyOn(CPUParticleNode.prototype, "applyConfig");

    for (let i: number = 0; i < 5; i++) {
      system.update({ world, dt: DT });
    }

    expect(spy).toHaveBeenCalledTimes(1);

    emitterOf(world, entity).setConfig(still({ rate: 3 }));
    system.update({ world, dt: DT });

    expect(spy).toHaveBeenCalledTimes(2);

    spy.mockRestore();
  });
});

describe("ParticleEmitterSystem state channel", () => {
  it("does not restart the emitter clock every frame while the state stays playing", () => {
    const { world, scene, system } = setup();
    mount(world, { config: still({ bursts: [{ time: 0, count: 2 }] }) });
    const spy = vi.spyOn(CPUParticleNode.prototype, "play");

    for (let i: number = 0; i < 10; i++) {
      system.update({ world, dt: DT });
    }

    expect(spy).toHaveBeenCalledTimes(1);
    expect(nodeOf(scene).aliveCount).toBe(2);

    spy.mockRestore();
  });

  it("restart re-arms a time zero burst and clears the command", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, {
      config: still({ bursts: [{ time: 0, count: 2 }] }),
    });

    for (let i: number = 0; i < 10; i++) {
      system.update({ world, dt: DT });
    }
    expect(nodeOf(scene).aliveCount).toBe(2);

    const emitter: ParticleEmitter = emitterOf(world, entity);
    emitter.restart();
    system.update({ world, dt: DT });

    expect(nodeOf(scene).aliveCount).toBe(4);
    expect(emitter.command).toBe("none");
  });

  it("clear empties the node and clears the command", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, {
      config: still({ bursts: [{ time: 0, count: 3 }] }),
    });

    system.update({ world, dt: DT });
    expect(nodeOf(scene).aliveCount).toBe(3);

    const emitter: ParticleEmitter = emitterOf(world, entity);
    emitter.clear();
    system.update({ world, dt: DT });

    expect(nodeOf(scene).aliveCount).toBe(0);
    expect(emitter.command).toBe("none");
  });

  it("stop halts emission while the live particles keep ageing until they die", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, {
      config: still({ rate: 100, startLifetime: 0.2 }),
    });

    system.update({ world, dt: 0.05 });
    const node: CPUParticleNode = nodeOf(scene);
    expect(node.aliveCount).toBe(5);

    emitterOf(world, entity).stop();
    system.update({ world, dt: 0.05 });

    expect(node.state).toBe("stopped");
    expect(node.aliveCount).toBe(5);

    system.update({ world, dt: 0.2 });

    expect(node.aliveCount).toBe(0);
  });

  it("pause freezes the particle count and the ages until play resumes", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, {
      config: still({ rate: 100, startLifetime: 10 }),
    });

    system.update({ world, dt: 0.05 });
    const node: CPUParticleNode = nodeOf(scene);
    expect(node.aliveCount).toBe(5);
    expect(node.getLifeT(0)).toBeCloseTo(0.005, 6);

    const emitter: ParticleEmitter = emitterOf(world, entity);
    emitter.pause();
    system.update({ world, dt: 0.05 });
    system.update({ world, dt: 0.05 });

    expect(node.state).toBe("paused");
    expect(node.aliveCount).toBe(5);
    expect(node.getLifeT(0)).toBeCloseTo(0.005, 6);

    emitter.play();
    system.update({ world, dt: 0.05 });

    expect(node.state).toBe("playing");
    expect(node.aliveCount).toBe(10);
    expect(node.getLifeT(0)).toBeCloseTo(0.01, 6);
  });
});

describe("ParticleEmitterSystem pendingEmit", () => {
  it("drains a whole pending count and zeroes the channel", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, {
      config: still(),
      playOnAwake: false,
    });
    const emitter: ParticleEmitter = emitterOf(world, entity);

    emitter.emit(4);
    system.update({ world, dt: DT });

    expect(nodeOf(scene).aliveCount).toBe(4);
    expect(emitter.pendingEmit).toBe(0);
  });

  it("keeps the fractional remainder as a carry and emits it once it completes", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, {
      config: still(),
      playOnAwake: false,
    });
    const emitter: ParticleEmitter = emitterOf(world, entity);

    emitter.emit(2.5);
    system.update({ world, dt: DT });

    const node: CPUParticleNode = nodeOf(scene);
    expect(node.aliveCount).toBe(2);
    expect(emitter.pendingEmit).toBeCloseTo(0.5, 6);

    emitter.emit(2.5);
    system.update({ world, dt: DT });

    expect(node.aliveCount).toBe(5);
    expect(emitter.pendingEmit).toBe(0);
  });
});

describe("ParticleEmitterSystem transform mirroring", () => {
  it("spawns world space particles on the emitter's current transform, not the previous frame's", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(
      world,
      {
        config: still({ simulationSpace: "world" }),
        playOnAwake: false,
      },
      500,
      300,
    );
    const emitter: ParticleEmitter = emitterOf(world, entity);

    emitter.emit(1);
    system.update({ world, dt: DT });

    const node: CPUParticleNode = nodeOf(scene);
    expect(node.getX(0)).toBeCloseTo(500, 6);
    expect(node.getY(0)).toBeCloseTo(300, 6);

    moveTo(world, entity, -120, 80);
    emitter.emit(1);
    system.update({ world, dt: DT });

    expect(node.aliveCount).toBe(2);
    expect(node.getX(1)).toBeCloseTo(-120, 6);
    expect(node.getY(1)).toBeCloseTo(80, 6);
  });

  it("tracks the world transform on the node TRS in local simulation space", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, {
      config: still({ simulationSpace: "local" }),
    });

    moveTo(world, entity, 100, 50, 0.5, 2, 3);
    system.update({ world, dt: DT });

    const node: CPUParticleNode = nodeOf(scene);
    expect(node.transform.position.x).toBeCloseTo(100, 4);
    expect(node.transform.position.y).toBeCloseTo(50, 4);
    expect(node.transform.rotation).toBeCloseTo(0.5, 6);
    expect(node.transform.scale.x).toBeCloseTo(2, 6);
    expect(node.transform.scale.y).toBeCloseTo(3, 6);
  });
});

describe("ParticleEmitterSystem frames", () => {
  it("normalizes the sprite rects and takes the shared texture", () => {
    const { world, scene, system } = setup();
    const texture: Texture2D = atlas();
    const frames: ReadonlyArray<Sprite> = [
      new Sprite(texture, { rect: new Bound(0, 0, 32, 32) }),
      new Sprite(texture, { rect: new Bound(32, 0, 32, 32) }),
    ];
    mount(world, { config: still(), frames });

    const spy = vi.spyOn(CPUParticleNode.prototype, "setFrameRects");

    system.update({ world, dt: DT });

    const node: CPUParticleNode = nodeOf(scene);
    expect(node.frameCount).toBe(2);
    expect(node.texture).toBe(texture);

    const rects: ReadonlyArray<Vec4> = spy.mock.calls[0][0];
    expect(rects).toHaveLength(2);
    expect(rects[0].x).toBeCloseTo(0, 6);
    expect(rects[0].y).toBeCloseTo(0, 6);
    expect(rects[0].z).toBeCloseTo(0.5, 6);
    expect(rects[0].w).toBeCloseTo(1, 6);
    expect(rects[1].x).toBeCloseTo(0.5, 6);
    expect(rects[1].y).toBeCloseTo(0, 6);
    expect(rects[1].z).toBeCloseTo(0.5, 6);
    expect(rects[1].w).toBeCloseTo(1, 6);

    spy.mockRestore();
  });

  it("rebuilds the frame table only when the frames array changes by reference", () => {
    const { world, system } = setup();
    const texture: Texture2D = atlas();
    const entity: Entity = mount(world, {
      config: still(),
      frames: [new Sprite(texture, { rect: new Bound(0, 0, 32, 32) })],
    });

    system.update({ world, dt: DT });

    const spy = vi.spyOn(CPUParticleNode.prototype, "setFrameRects");

    for (let i: number = 0; i < 5; i++) {
      system.update({ world, dt: DT });
    }

    expect(spy).not.toHaveBeenCalled();

    emitterOf(world, entity).frames = [
      new Sprite(texture, { rect: new Bound(32, 0, 32, 32) }),
    ];
    system.update({ world, dt: DT });

    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });

  it("leaves an emitter with no frames untextured", () => {
    const { world, scene, system } = setup();
    mount(world, { config: still(), frames: [] });

    system.update({ world, dt: DT });

    const node: CPUParticleNode = nodeOf(scene);
    expect(node.texture).toBeNull();
    expect(node.frameCount).toBe(0);
  });

  it("throws when the frames do not all share a single texture", () => {
    const { world, system } = setup();
    const frames: ReadonlyArray<Sprite> = [
      new Sprite(fakeTexture("atlas-a", 64, 32)),
      new Sprite(fakeTexture("atlas-b", 64, 32)),
    ];
    mount(world, { config: still(), frames });

    expect(() => system.update({ world, dt: DT })).toThrow(
      /frames must all share a single Texture2D/,
    );
  });
});

describe("ParticleEmitterSystem detach", () => {
  it("keeps the node in the scene until every particle expires", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, {
      config: still({ startLifetime: 0.2 }),
      playOnAwake: false,
    });

    emitterOf(world, entity).emit(3);
    system.update({ world, dt: 0.05 });

    const node: CPUParticleNode = nodeOf(scene);
    expect(node.aliveCount).toBe(3);

    system.detach(entity);
    world.destroyEntity(entity);

    expect(scene.root.getChildren()).toHaveLength(1);

    system.update({ world, dt: 0.05 });
    expect(scene.root.getChildren()).toHaveLength(1);

    system.update({ world, dt: 0.2 });
    expect(scene.root.getChildren()).toHaveLength(0);
  });

  it("stops emission on detach so the detached node never gains particles", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, {
      config: still({ rate: 100, startLifetime: 10 }),
    });

    system.update({ world, dt: 0.05 });
    const node: CPUParticleNode = nodeOf(scene);
    expect(node.aliveCount).toBe(5);

    system.detach(entity);
    world.destroyEntity(entity);

    system.update({ world, dt: 0.05 });
    expect(node.aliveCount).toBe(5);

    system.update({ world, dt: 0.05 });
    expect(node.aliveCount).toBe(5);
    expect(node.state).toBe("stopped");
  });

  it("clear removes the remaining orphans from the scene", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, {
      config: still({ startLifetime: 10 }),
      playOnAwake: false,
    });

    emitterOf(world, entity).emit(2);
    system.update({ world, dt: DT });

    system.detach(entity);
    system.clear();

    expect(scene.root.getChildren()).toHaveLength(0);
  });
});

describe("ParticleEmitterSystem time scale", () => {
  it("freezes ageing and spawning at a scale of zero", () => {
    const { world, scene, timeScale, system } = setup();
    const entity: Entity = mount(world, {
      config: still({ rate: 100, startLifetime: 10 }),
    });

    timeScale.setScale(entity, 0);
    system.update({ world, dt: 0.05 });

    expect(nodeOf(scene).aliveCount).toBe(0);
  });

  it("ages the particles at half rate at a scale of one half", () => {
    const { world, scene, timeScale, system } = setup();
    const entity: Entity = mount(world, {
      config: still({ startLifetime: 10 }),
      playOnAwake: false,
    });

    emitterOf(world, entity).emit(1);
    system.update({ world, dt: 0.5 });

    const node: CPUParticleNode = nodeOf(scene);
    expect(node.getLifeT(0)).toBeCloseTo(0.05, 6);

    timeScale.setScale(entity, 0.5);
    system.update({ world, dt: 0.5 });

    expect(node.getLifeT(0)).toBeCloseTo(0.075, 6);
  });

  it("advances a detached node at the raw dt even when its entity was frozen", () => {
    const { world, scene, timeScale, system } = setup();
    const entity: Entity = mount(world, {
      config: still({ startLifetime: 10 }),
      playOnAwake: false,
    });

    emitterOf(world, entity).emit(1);
    system.update({ world, dt: 0.1 });

    const node: CPUParticleNode = nodeOf(scene);
    expect(node.getLifeT(0)).toBeCloseTo(0.01, 6);

    timeScale.setScale(entity, 0);
    system.update({ world, dt: 0.1 });
    expect(node.getLifeT(0)).toBeCloseTo(0.01, 6);

    system.detach(entity);
    world.destroyEntity(entity);
    system.update({ world, dt: 0.1 });

    expect(node.getLifeT(0)).toBeCloseTo(0.02, 6);
  });

  it("uses the raw dt when the system is built without a TimeScaleManager", () => {
    const { world, scene, timeScale, system } = setup(false);
    const entity: Entity = mount(world, {
      config: still({ startLifetime: 10 }),
      playOnAwake: false,
    });

    emitterOf(world, entity).emit(1);
    timeScale.setScale(entity, 0);
    system.update({ world, dt: 0.1 });

    expect(nodeOf(scene).getLifeT(0)).toBeCloseTo(0.01, 6);
  });
});
