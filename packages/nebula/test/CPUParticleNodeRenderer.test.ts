import { Bound, Mat4, Vec4 } from "@atlasjs/math";
import { describe, expect, it } from "vitest";
import { CPUParticleNode } from "../src/graphics/CPUParticleNode";
import type { ParticleEmitterConfig } from "../src/graphics/particle-types";
import { CPUParticleNodeRenderer } from "../src/renderers/CPUParticleNodeRenderer";
import { ParticleBatcher } from "../src/renderers/Batchers";
import { KIND_ORDER } from "../src/renderers/NodeRenderer";
import type { ParticleDrawCommand } from "../src/renderers/DrawCommand";
import { SceneRenderer } from "../src/renderers/SceneRenderer";
import { SceneGraph } from "../src/scene";
import { Color } from "../src/utils/Color";
import type {
  InstancedBatch,
  RenderState,
  Renderer,
  Sampler,
  ShapeBatch,
  SpriteBatch,
  Texture2D,
  TrailBatch,
} from "../src/core";
import { fakeTexture } from "./helpers/fakes";

const WIDE: Bound = new Bound(-10_000, -10_000, 20_000, 20_000);

type SpriteEntry = {
  model: Mat4;
  uvRect: Vec4;
  tint: Vec4;
};

class RecordingSpriteBatch implements SpriteBatch {
  public readonly __kind: string = "test";
  public readonly entries: SpriteEntry[] = [];
  public readonly begins: string[] = [];
  public renderState: RenderState = {
    blend: "alpha",
    depthTest: false,
    cull: "none",
  };

  public get count(): number {
    return this.entries.length;
  }

  public begin(
    texture: Texture2D,
    _sampler: Sampler,
    renderState: RenderState,
  ): void {
    this.entries.length = 0;
    this.begins.push(texture.id);
    this.renderState = renderState;
  }

  public add(model: Mat4, uvRect: Vec4, tint: Vec4): void {
    this.entries.push({ model, uvRect, tint });
  }

  public destroy(): void {}
}

function fakeRenderer(): Renderer {
  return {
    createSampler: (): Sampler => ({ id: "default-sampler" }) as Sampler,
    createSpriteBatch: (): SpriteBatch => new RecordingSpriteBatch(),
  } as unknown as Renderer;
}

function emitterOf(overrides: ParticleEmitterConfig = {}): CPUParticleNode {
  const node: CPUParticleNode = new CPUParticleNode({
    rate: 0,
    startSpeed: 0,
    startLifetime: 100,
    startSize: 8,
    startRotation: 0,
    duration: 1000,
    looping: false,
    maxParticles: 64,
    shape: { kind: "cone", angle: 0, radius: 0, rotation: 0 },
    ...overrides,
  });

  node.texture = fakeTexture("particle");
  node.sampler = { id: "smp" } as Sampler;

  return node;
}

function collect(
  node: CPUParticleNode,
  renderer: CPUParticleNodeRenderer = new CPUParticleNodeRenderer(
    fakeRenderer(),
  ),
  viewport: Bound = WIDE,
): ParticleDrawCommand | null {
  return renderer.collect(node, viewport, new Bound());
}

describe("CPUParticleNodeRenderer.collect gating", () => {
  it("returns null when the node has no texture", () => {
    const node: CPUParticleNode = emitterOf();
    node.texture = null;
    node.updateWorldMatrix();
    node.emit(1);

    expect(collect(node)).toBeNull();
  });

  it("returns null when no particle is alive", () => {
    const node: CPUParticleNode = emitterOf();
    node.updateWorldMatrix();

    expect(node.aliveCount).toEqual(0);
    expect(collect(node)).toBeNull();
  });
});

describe("CPUParticleNodeRenderer instance models", () => {
  it("places a world space particle at its own position and size", () => {
    const node: CPUParticleNode = emitterOf({
      simulationSpace: "world",
      startSize: 8,
      shape: { kind: "cone", angle: 0, radius: 50, rotation: 0 },
    });
    node.updateWorldMatrix();
    node.emit(1);

    const cmd: ParticleDrawCommand = collect(node) as ParticleDrawCommand;

    expect(cmd).not.toBeNull();
    expect(cmd.count).toEqual(1);
    expect(cmd.models[0].buffer[12]).toBeCloseTo(50, 4);
    expect(cmd.models[0].buffer[13]).toBeCloseTo(0, 4);
    expect(cmd.models[0].buffer[0]).toBeCloseTo(8, 4);
    expect(cmd.models[0].buffer[5]).toBeCloseTo(8, 4);
  });

  it("adds the node world offset once in local space", () => {
    const node: CPUParticleNode = emitterOf({
      simulationSpace: "local",
      shape: { kind: "cone", angle: 0, radius: 10, rotation: 0 },
    });
    node.setPosition(100, 50);
    node.updateWorldMatrix();
    node.emit(1);

    const cmd: ParticleDrawCommand = collect(node) as ParticleDrawCommand;

    expect(node.getX(0)).toBeCloseTo(10, 4);
    expect(cmd.models[0].buffer[12]).toBeCloseTo(110, 4);
    expect(cmd.models[0].buffer[13]).toBeCloseTo(50, 4);
  });

  it("does not add the node world offset twice in world space", () => {
    const node: CPUParticleNode = emitterOf({
      simulationSpace: "world",
      shape: { kind: "cone", angle: 0, radius: 10, rotation: 0 },
    });
    node.setPosition(100, 50);
    node.updateWorldMatrix();
    node.emit(1);

    const cmd: ParticleDrawCommand = collect(node) as ParticleDrawCommand;

    expect(node.getX(0)).toBeCloseTo(110, 4);
    expect(cmd.models[0].buffer[12]).toBeCloseTo(110, 4);
    expect(cmd.models[0].buffer[13]).toBeCloseTo(50, 4);
  });

  it("writes the particle rotation into the model basis", () => {
    const node: CPUParticleNode = emitterOf({ startRotation: Math.PI / 2 });
    node.updateWorldMatrix();
    node.emit(1);

    const cmd: ParticleDrawCommand = collect(node) as ParticleDrawCommand;
    const m: Float32Array = cmd.models[0].buffer;

    expect(m[0]).toBeCloseTo(Math.cos(Math.PI / 2) * 8, 4);
    expect(m[1]).toBeCloseTo(Math.sin(Math.PI / 2) * 8, 4);
    expect(m[4]).toBeCloseTo(-Math.sin(Math.PI / 2) * 8, 4);
    expect(m[5]).toBeCloseTo(Math.cos(Math.PI / 2) * 8, 4);
  });
});

describe("CPUParticleNodeRenderer alignment", () => {
  it("aligns a moving particle on its velocity instead of its rotation", () => {
    const config: ParticleEmitterConfig = {
      startSpeed: 100,
      startRotation: 0,
      shape: { kind: "cone", angle: 0, radius: 0, rotation: Math.PI / 2 },
    };

    const fixed: CPUParticleNode = emitterOf({
      ...config,
      alignment: "fixed",
    });
    fixed.updateWorldMatrix();
    fixed.emit(1);

    const aligned: CPUParticleNode = emitterOf({
      ...config,
      alignment: "velocity",
    });
    aligned.updateWorldMatrix();
    aligned.emit(1);

    const fixedCmd: ParticleDrawCommand = collect(fixed) as ParticleDrawCommand;
    const alignedCmd: ParticleDrawCommand = collect(
      aligned,
    ) as ParticleDrawCommand;

    expect(fixedCmd.models[0].buffer[1]).toBeCloseTo(0, 4);
    expect(alignedCmd.models[0].buffer[1]).toBeCloseTo(8, 4);
    expect(alignedCmd.models[0].buffer[0]).toBeCloseTo(0, 4);
  });

  it("keeps the particle rotation when the velocity is degenerate", () => {
    const config: ParticleEmitterConfig = {
      startSpeed: 0,
      startRotation: 0.3,
    };

    const fixed: CPUParticleNode = emitterOf({
      ...config,
      alignment: "fixed",
    });
    fixed.updateWorldMatrix();
    fixed.emit(1);

    const aligned: CPUParticleNode = emitterOf({
      ...config,
      alignment: "velocity",
    });
    aligned.updateWorldMatrix();
    aligned.emit(1);

    const fixedCmd: ParticleDrawCommand = collect(fixed) as ParticleDrawCommand;
    const alignedCmd: ParticleDrawCommand = collect(
      aligned,
    ) as ParticleDrawCommand;

    expect(alignedCmd.models[0].buffer[0]).toBeCloseTo(Math.cos(0.3) * 8, 4);
    expect(alignedCmd.models[0].buffer[1]).toBeCloseTo(Math.sin(0.3) * 8, 4);
    expect(alignedCmd.models[0].buffer[0]).toBeCloseTo(
      fixedCmd.models[0].buffer[0],
      4,
    );
  });
});

describe("CPUParticleNodeRenderer per instance tints", () => {
  it("writes one tint per particle", () => {
    const node: CPUParticleNode = emitterOf();
    node.updateWorldMatrix();

    node.startColor = new Color(1, 0, 0, 1);
    node.emit(1);
    node.startColor = new Color(0, 0, 1, 0.5);
    node.emit(1);

    const cmd: ParticleDrawCommand = collect(node) as ParticleDrawCommand;

    expect(cmd.count).toEqual(2);
    expect(cmd.tints[0]).not.toBe(cmd.tints[1]);
    expect(cmd.tints[0].x).toBeCloseTo(1, 6);
    expect(cmd.tints[0].z).toBeCloseTo(0, 6);
    expect(cmd.tints[1].x).toBeCloseTo(0, 6);
    expect(cmd.tints[1].z).toBeCloseTo(1, 6);
    expect(cmd.tints[1].w).toBeCloseTo(0.5, 6);
  });

  it("gives every particle the full uv rect", () => {
    const node: CPUParticleNode = emitterOf();
    node.updateWorldMatrix();
    node.emit(2);

    const cmd: ParticleDrawCommand = collect(node) as ParticleDrawCommand;

    expect(cmd.uvRects[0].x).toEqual(0);
    expect(cmd.uvRects[0].y).toEqual(0);
    expect(cmd.uvRects[0].z).toEqual(1);
    expect(cmd.uvRects[0].w).toEqual(1);
    expect(cmd.uvRects[1]).not.toBe(cmd.uvRects[0]);
  });
});

describe("CPUParticleNodeRenderer command identity", () => {
  it("reports the particle kind, order and blend derived render state", () => {
    const node: CPUParticleNode = emitterOf({ blend: "additive" });
    node.sortingLayer = 3;
    node.sortPrimary = 7;
    node.sortSecondary = 11;
    node.updateWorldMatrix();
    node.emit(1);

    const cmd: ParticleDrawCommand = collect(node) as ParticleDrawCommand;

    expect(cmd.kind).toEqual("particle");
    expect(cmd.kindOrder).toEqual(KIND_ORDER.particle);
    expect(KIND_ORDER.particle).toEqual(4);
    expect(cmd.renderState.blend).toEqual("additive");
    expect(cmd.sortingLayer).toEqual(3);
    expect(cmd.sortPrimary).toEqual(7);
    expect(cmd.sortSecondary).toEqual(11);
    expect(cmd.texture.id).toEqual("particle");
    expect(cmd.sampler.id).toEqual("smp");
  });

  it("shares a batch key across nodes with the same material", () => {
    const renderer: CPUParticleNodeRenderer = new CPUParticleNodeRenderer(
      fakeRenderer(),
    );

    const first: CPUParticleNode = emitterOf();
    first.updateWorldMatrix();
    first.emit(1);

    const second: CPUParticleNode = emitterOf();
    second.updateWorldMatrix();
    second.emit(1);

    const other: CPUParticleNode = emitterOf({ blend: "additive" });
    other.updateWorldMatrix();
    other.emit(1);

    const a: ParticleDrawCommand = collect(
      first,
      renderer,
    ) as ParticleDrawCommand;
    const b: ParticleDrawCommand = collect(
      second,
      renderer,
    ) as ParticleDrawCommand;
    const c: ParticleDrawCommand = collect(
      other,
      renderer,
    ) as ParticleDrawCommand;

    expect(b.batchKey).toEqual(a.batchKey);
    expect(c.batchKey).not.toEqual(a.batchKey);
  });

  it("falls back on the default sampler when the node has none", () => {
    const node: CPUParticleNode = emitterOf();
    node.sampler = undefined;
    node.updateWorldMatrix();
    node.emit(1);

    const cmd: ParticleDrawCommand = collect(node) as ParticleDrawCommand;

    expect(cmd.sampler.id).toEqual("default-sampler");
  });
});

describe("CPUParticleNodeRenderer instance pooling", () => {
  it("reuses the same arrays and matrices across frames", () => {
    const renderer: CPUParticleNodeRenderer = new CPUParticleNodeRenderer(
      fakeRenderer(),
    );
    const node: CPUParticleNode = emitterOf();
    node.updateWorldMatrix();
    node.emit(3);

    const first: ParticleDrawCommand = collect(
      node,
      renderer,
    ) as ParticleDrawCommand;
    const models: ReadonlyArray<Mat4> = first.models;
    const model0: Mat4 = first.models[0];
    const tint0: Vec4 = first.tints[0];

    const second: ParticleDrawCommand = collect(
      node,
      renderer,
    ) as ParticleDrawCommand;

    expect(second.models).toBe(models);
    expect(second.models[0]).toBe(model0);
    expect(second.models[2]).toBe(first.models[2]);
    expect(second.tints[0]).toBe(tint0);
  });

  it("keeps count authoritative and never reallocates a regrown pool", () => {
    const renderer: CPUParticleNodeRenderer = new CPUParticleNodeRenderer(
      fakeRenderer(),
    );
    const node: CPUParticleNode = emitterOf({ startLifetime: 0.5 });
    node.updateWorldMatrix();
    node.emit(1);

    node.startLifetime = 100;
    node.emit(2);

    const first: ParticleDrawCommand = collect(
      node,
      renderer,
    ) as ParticleDrawCommand;

    expect(first.count).toEqual(3);

    const pooled: Mat4 = first.models[2];

    node.advance(1);

    expect(node.aliveCount).toEqual(2);

    const second: ParticleDrawCommand = collect(
      node,
      renderer,
    ) as ParticleDrawCommand;

    expect(second.count).toEqual(2);

    node.emit(1);

    const third: ParticleDrawCommand = collect(
      node,
      renderer,
    ) as ParticleDrawCommand;

    expect(third.count).toEqual(3);
    expect(third.models[2]).toBe(pooled);
    expect(third.models).toBe(first.models);
  });
});

describe("CPUParticleNodeRenderer culling", () => {
  it("bounds the cloud on the particle positions, not on the node transform", () => {
    const node: CPUParticleNode = emitterOf({
      simulationSpace: "world",
      startSpeed: 1000,
      shape: { kind: "cone", angle: 0, radius: 0, rotation: 0 },
    });
    node.updateWorldMatrix();
    node.emit(1);
    node.advance(1);

    expect(node.getX(0)).toBeCloseTo(1000, 3);

    const nearEmitter: Bound = new Bound(-50, -50, 100, 100);
    const nearParticle: Bound = new Bound(950, -50, 100, 100);

    expect(collect(node, undefined, nearEmitter)).toBeNull();
    expect(collect(node, undefined, nearParticle)).not.toBeNull();
    expect(collect(node, undefined, WIDE)).not.toBeNull();
  });

  it("culls a local space cloud through the node world matrix", () => {
    const node: CPUParticleNode = emitterOf({ simulationSpace: "local" });
    node.setPosition(5000, 0);
    node.updateWorldMatrix();
    node.emit(1);

    expect(collect(node, undefined, new Bound(-50, -50, 100, 100))).toBeNull();
    expect(
      collect(node, undefined, new Bound(4950, -50, 100, 100)),
    ).not.toBeNull();
  });
});

describe("ParticleBatcher", () => {
  it("adds one sprite instance per particle in order", () => {
    const batch: RecordingSpriteBatch = new RecordingSpriteBatch();
    const batcher: ParticleBatcher = new ParticleBatcher(batch);

    const node: CPUParticleNode = emitterOf();
    node.updateWorldMatrix();
    node.emit(3);

    const cmd: ParticleDrawCommand = collect(node) as ParticleDrawCommand;

    batcher.begin(cmd);
    batcher.add(cmd);

    expect(batch.begins).toEqual(["particle"]);
    expect(batch.entries.length).toEqual(3);

    for (let i: number = 0; i < 3; i++) {
      expect(batch.entries[i].model).toBe(cmd.models[i]);
      expect(batch.entries[i].uvRect).toBe(cmd.uvRects[i]);
      expect(batch.entries[i].tint).toBe(cmd.tints[i]);
    }
  });
});

describe("SceneRenderer particle registration", () => {
  it("submits and draws a particle node found in the scene graph", () => {
    const batches: RecordingSpriteBatch[] = [];
    const drawn: InstancedBatch[] = [];

    const renderer: Renderer = {
      createSampler: (): Sampler => ({ id: "default-sampler" }) as Sampler,
      createSpriteBatch: (): SpriteBatch => {
        const batch: RecordingSpriteBatch = new RecordingSpriteBatch();
        batches.push(batch);
        return batch;
      },
      createShapeBatch: (): ShapeBatch => ({}) as ShapeBatch,
      createTrailBatch: (): TrailBatch => ({}) as TrailBatch,
      getCameraViewport: (): Bound => WIDE,
      beginFrame: (): void => {},
      endFrame: (): void => {},
      drawInstancedBatch: (batch: InstancedBatch): void => {
        drawn.push(batch);
      },
    } as unknown as Renderer;

    const scene: SceneGraph = new SceneGraph();
    const node: CPUParticleNode = emitterOf();
    scene.addChild(node);
    scene.updateWorldMatrices();
    node.emit(2);

    new SceneRenderer(renderer).render(scene);

    const particleBatch: RecordingSpriteBatch | undefined = batches.find(
      (batch: RecordingSpriteBatch) => batch.begins.length > 0,
    );

    expect(particleBatch).not.toBeUndefined();
    expect((particleBatch as RecordingSpriteBatch).entries.length).toEqual(2);
    expect(drawn).toContain(particleBatch as InstancedBatch);
  });
});
