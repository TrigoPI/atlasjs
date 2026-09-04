import { Vec2, Vec4 } from "@atlasjs/math";
import { describe, expect, it } from "vitest";
import { CPUParticleNode } from "../src/graphics/CPUParticleNode";
import type {
  ParticleBurst,
  ParticleEmitterConfig,
} from "../src/graphics/particle-types";
import type { Sampler, Texture2D } from "../src/core";
import { Color } from "../src/utils/Color";

const SEEDED: ParticleEmitterConfig = {
  rate: 0,
  startSpeed: { min: 0, max: 100 },
  startLifetime: 100,
  startSize: 1,
  duration: 1000,
  looping: false,
  maxParticles: 16,
};

function seeded(seed: number): CPUParticleNode {
  return new CPUParticleNode({ ...SEEDED, seed });
}

function fakeTexture(): Texture2D {
  return {
    id: "tex",
    __kind: "texture2D",
    width: 64,
    height: 32,
    destroy: (): void => {},
  } as Texture2D;
}

function fakeSampler(): Sampler {
  return { id: "sampler", __kind: "sampler" } as unknown as Sampler;
}

describe("CPUParticleNode.applyConfig", () => {
  it("lands every simulation and appearance field", () => {
    const node: CPUParticleNode = new CPUParticleNode();
    const bursts: readonly ParticleBurst[] = [{ time: 0.5, count: 3 }];
    const startColor: Color = new Color(0.1, 0.2, 0.3, 0.4);

    node.applyConfig({
      duration: 2.5,
      looping: false,
      prewarm: true,
      maxParticles: 32,
      rate: 42,
      bursts,
      shape: { kind: "circle", radius: 12 },
      startLifetime: { min: 1, max: 2 },
      startSpeed: 7,
      startSize: 9,
      startRotation: 1.5,
      startColor,
      angularVelocity: 3,
      gravity: { x: 5, y: -9 },
      drag: 0.25,
      sizeOverLifetime: { from: 1, to: 0, easing: "outCubic" },
      colorOverLifetime: {
        from: new Color(1, 1, 1, 1),
        to: new Color(0, 0, 0, 0),
      },
      velocityOverLifetime: { from: { x: 0, y: 0 }, to: { x: 10, y: 20 } },
      simulationSpace: "world",
      alignment: "velocity",
      blend: "additive",
      textureSheet: { mode: "randomFrame" },
    });

    expect(node.duration).toBe(2.5);
    expect(node.looping).toBe(false);
    expect(node.prewarm).toBe(true);
    expect(node.maxParticles).toBe(32);
    expect(node.capacity).toBe(32);
    expect(node.rate).toBe(42);
    expect(node.bursts).toBe(bursts);
    expect(node.shape).toEqual({ kind: "circle", radius: 12 });
    expect(node.startLifetime).toEqual({ min: 1, max: 2 });
    expect(node.startSpeed).toBe(7);
    expect(node.startSize).toBe(9);
    expect(node.startRotation).toBe(1.5);
    expect(node.startColor).toBe(startColor);
    expect(node.angularVelocity).toBe(3);
    expect(node.gravity.x).toBe(5);
    expect(node.gravity.y).toBe(-9);
    expect(node.drag).toBe(0.25);
    expect(node.sizeOverLifetime).toEqual({
      from: 1,
      to: 0,
      easing: "outCubic",
    });
    expect(node.colorOverLifetime?.to).toEqual(new Color(0, 0, 0, 0));
    expect(node.velocityOverLifetime?.to).toEqual({ x: 10, y: 20 });
    expect(node.simulationSpace).toBe("world");
    expect(node.alignment).toBe("velocity");
    expect(node.blend).toBe("additive");
    expect(node.textureSheet).toEqual({ mode: "randomFrame" });
  });

  it("restores the constructor defaults for every field an empty config omits", () => {
    const node: CPUParticleNode = new CPUParticleNode({
      duration: 2.5,
      looping: false,
      prewarm: true,
      maxParticles: 32,
      rate: 42,
      bursts: [{ time: 0.5, count: 3 }],
      shape: { kind: "circle", radius: 12 },
      startLifetime: 5,
      startSpeed: 7,
      startSize: 9,
      startRotation: 1.5,
      startColor: new Color(0.1, 0.2, 0.3, 0.4),
      angularVelocity: 3,
      gravity: { x: 5, y: -9 },
      drag: 0.25,
      sizeOverLifetime: { from: 1, to: 0 },
      colorOverLifetime: {
        from: new Color(1, 1, 1, 1),
        to: new Color(0, 0, 0, 0),
      },
      velocityOverLifetime: { from: { x: 0, y: 0 }, to: { x: 10, y: 20 } },
      simulationSpace: "world",
      alignment: "velocity",
      blend: "additive",
      textureSheet: { mode: "randomFrame" },
    });

    const reference: CPUParticleNode = new CPUParticleNode();

    node.applyConfig({});

    expect(node.duration).toBe(reference.duration);
    expect(node.looping).toBe(reference.looping);
    expect(node.prewarm).toBe(reference.prewarm);
    expect(node.maxParticles).toBe(reference.maxParticles);
    expect(node.capacity).toBe(reference.capacity);
    expect(node.rate).toBe(reference.rate);
    expect(node.bursts).toHaveLength(0);
    expect(node.shape).toEqual(reference.shape);
    expect(node.startLifetime).toBe(reference.startLifetime);
    expect(node.startSpeed).toBe(reference.startSpeed);
    expect(node.startSize).toBe(reference.startSize);
    expect(node.startRotation).toBe(reference.startRotation);
    expect(node.startColor).toEqual(reference.startColor);
    expect(node.angularVelocity).toBe(reference.angularVelocity);
    expect(node.gravity.x).toBe(0);
    expect(node.gravity.y).toBe(0);
    expect(node.drag).toBe(reference.drag);
    expect(node.sizeOverLifetime).toBeNull();
    expect(node.colorOverLifetime).toBeNull();
    expect(node.velocityOverLifetime).toBeNull();
    expect(node.simulationSpace).toBe(reference.simulationSpace);
    expect(node.alignment).toBe(reference.alignment);
    expect(node.blend).toBe(reference.blend);
    expect(node.textureSheet).toBeNull();
  });

  it("mutates the gravity vector in place instead of replacing it", () => {
    const node: CPUParticleNode = new CPUParticleNode({
      gravity: { x: 1, y: 2 },
    });
    const gravity: Vec2 = node.gravity;

    node.applyConfig({ gravity: { x: -3, y: 4 } });

    expect(node.gravity).toBe(gravity);
    expect(gravity.x).toBe(-3);
    expect(gravity.y).toBe(4);
  });

  it("resizes the particle pool through the maxParticles setter", () => {
    const node: CPUParticleNode = new CPUParticleNode({ maxParticles: 4 });
    expect(node.capacity).toBe(4);

    node.applyConfig({ maxParticles: 64 });

    expect(node.maxParticles).toBe(64);
    expect(node.capacity).toBe(64);

    node.applyConfig({ maxParticles: 8 });

    expect(node.maxParticles).toBe(8);
    expect(node.capacity).toBe(8);
  });

  it("keeps the caller's bursts array by reference rather than cloning it", () => {
    const node: CPUParticleNode = new CPUParticleNode();
    const bursts: readonly ParticleBurst[] = [
      { time: 0, count: 2 },
      { time: 1, count: 4 },
    ];

    node.applyConfig({ bursts });

    expect(node.bursts).toBe(bursts);
  });

  it("re-arms the bursts of a freshly applied config", () => {
    const node: CPUParticleNode = new CPUParticleNode({
      ...SEEDED,
      rate: 0,
    });

    node.play();
    node.advance(0.1);
    expect(node.aliveCount).toBe(0);

    node.applyConfig({ ...SEEDED, rate: 0, bursts: [{ time: 0, count: 5 }] });
    node.play();
    node.advance(0.1);

    expect(node.aliveCount).toBe(5);
  });

  it("leaves texture and sampler untouched", () => {
    const node: CPUParticleNode = new CPUParticleNode();
    const texture: Texture2D = fakeTexture();
    const sampler: Sampler = fakeSampler();

    node.texture = texture;
    node.sampler = sampler;

    node.applyConfig({ rate: 5 });

    expect(node.texture).toBe(texture);
    expect(node.sampler).toBe(sampler);
  });

  it("leaves the frame rect table untouched", () => {
    const node: CPUParticleNode = new CPUParticleNode();

    node.setFrameRects([new Vec4(0, 0, 0.5, 1), new Vec4(0.5, 0, 0.5, 1)]);

    node.applyConfig({ rate: 5 });

    expect(node.frameCount).toBe(2);
  });

  it("does not re-seed a live node, so its random stream keeps running", () => {
    const control: CPUParticleNode = seeded(1);
    control.emit(4);

    const node: CPUParticleNode = seeded(1);
    node.emit(2);
    node.applyConfig({ ...SEEDED, seed: 999 });
    node.emit(2);

    expect(node.aliveCount).toBe(4);

    for (let i: number = 0; i < 4; i++) {
      expect(node.getVelocityX(i)).toBeCloseTo(control.getVelocityX(i), 6);
    }
  });

  it("would produce a different stream from a different seed at construction", () => {
    const a: CPUParticleNode = seeded(1);
    const b: CPUParticleNode = seeded(999);

    a.emit(4);
    b.emit(4);

    let different: boolean = false;

    for (let i: number = 0; i < 4; i++) {
      if (Math.abs(a.getVelocityX(i) - b.getVelocityX(i)) > 1e-6) {
        different = true;
      }
    }

    expect(different).toBe(true);
  });

  it("keeps the emitter state and the living particles across a config change", () => {
    const node: CPUParticleNode = seeded(1);

    node.play();
    node.emit(3);

    node.applyConfig({ ...SEEDED, seed: 1, drag: 1 });

    expect(node.state).toBe("playing");
    expect(node.aliveCount).toBe(3);
  });
});
