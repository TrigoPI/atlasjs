import { Vec4 } from "@atlasjs/math";
import { describe, expect, it } from "vitest";
import { CPUParticleNode } from "../src/graphics/CPUParticleNode";
import type { ParticleEmitterConfig } from "../src/graphics/particle-types";

function sheetRects(count: number): Vec4[] {
  const rects: Vec4[] = [];

  for (let i: number = 0; i < count; i++) {
    rects.push(new Vec4(i / count, 0, 1 / count, 1));
  }

  return rects;
}

function still(overrides: ParticleEmitterConfig = {}): CPUParticleNode {
  return new CPUParticleNode({
    rate: 0,
    startSpeed: 0,
    startLifetime: 1,
    startSize: 1,
    duration: 1000,
    looping: false,
    maxParticles: 64,
    ...overrides,
  });
}

function sheeted(
  rects: Vec4[],
  overrides: ParticleEmitterConfig = {},
): CPUParticleNode {
  const node: CPUParticleNode = still(overrides);
  node.setFrameRects(rects);
  return node;
}

function frameOf(rects: Vec4[], node: CPUParticleNode, index: number): number {
  return rects.indexOf(node.getFrameRect(index));
}

describe("CPUParticleNode texture sheet over lifetime", () => {
  it("starts on the first frame and advances monotonically", () => {
    const rects: Vec4[] = sheetRects(4);
    const node: CPUParticleNode = sheeted(rects, {
      textureSheet: { mode: "overLifetime" },
    });
    node.emit(1);

    expect(frameOf(rects, node, 0)).toEqual(0);

    let previous: number = 0;
    let highest: number = 0;

    for (let i: number = 0; i < 19; i++) {
      node.advance(0.05);

      const current: number = frameOf(rects, node, 0);

      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
      highest = current;
    }

    expect(highest).toEqual(3);
  });

  it("holds the last frame at the end of life instead of wrapping to zero", () => {
    const rects: Vec4[] = sheetRects(4);
    const node: CPUParticleNode = sheeted(rects, {
      textureSheet: { mode: "overLifetime", cycles: 1 },
    });
    node.emit(1);
    node.advance(1 - 1e-8);

    expect(node.aliveCount).toEqual(1);
    expect(node.getLifeT(0)).toEqual(1);
    expect(frameOf(rects, node, 0)).toEqual(3);
  });

  it("runs the sequence twice over one lifetime when cycles is two", () => {
    const rects: Vec4[] = sheetRects(4);
    const node: CPUParticleNode = sheeted(rects, {
      textureSheet: { mode: "overLifetime", cycles: 2 },
    });
    node.emit(1);

    node.advance(0.25);
    expect(frameOf(rects, node, 0)).toEqual(2);

    node.advance(0.25);
    expect(node.getLifeT(0)).toEqual(0.5);
    expect(frameOf(rects, node, 0)).toEqual(0);

    node.advance(0.25);
    expect(frameOf(rects, node, 0)).toEqual(2);
  });
});

describe("CPUParticleNode texture sheet cycles sanitising", () => {
  function frameAtHalfLife(cycles: number | undefined): number {
    const rects: Vec4[] = sheetRects(4);
    const node: CPUParticleNode = sheeted(rects, {
      textureSheet: { mode: "overLifetime", cycles },
    });
    node.emit(1);
    node.advance(0.5);

    return frameOf(rects, node, 0);
  }

  it("treats zero cycles as one", () => {
    expect(frameAtHalfLife(0)).toEqual(2);
  });

  it("treats negative cycles as one", () => {
    expect(frameAtHalfLife(-1)).toEqual(2);
  });

  it("treats a non finite cycle count as one", () => {
    expect(frameAtHalfLife(Number.NaN)).toEqual(2);
  });

  it("treats an absent cycle count as one", () => {
    expect(frameAtHalfLife(undefined)).toEqual(2);
  });
});

describe("CPUParticleNode texture sheet random frame", () => {
  it("keeps one particle on the same frame for its whole life", () => {
    const rects: Vec4[] = sheetRects(4);
    const node: CPUParticleNode = sheeted(rects, {
      textureSheet: { mode: "randomFrame" },
      seed: 1,
    });
    node.emit(1);

    const first: Vec4 = node.getFrameRect(0);

    for (let i: number = 0; i < 15; i++) {
      node.advance(0.05);
      expect(node.getFrameRect(0)).toBe(first);
    }
  });

  it("agrees particle for particle between two identically seeded nodes", () => {
    const leftRects: Vec4[] = sheetRects(4);
    const rightRects: Vec4[] = sheetRects(4);
    const left: CPUParticleNode = sheeted(leftRects, {
      textureSheet: { mode: "randomFrame" },
      seed: 4242,
    });
    const right: CPUParticleNode = sheeted(rightRects, {
      textureSheet: { mode: "randomFrame" },
      seed: 4242,
    });

    left.emit(12);
    right.emit(12);

    expect(left.aliveCount).toEqual(12);

    for (let i: number = 0; i < left.aliveCount; i++) {
      expect(frameOf(rightRects, right, i)).toEqual(
        frameOf(leftRects, left, i),
      );
    }
  });

  it("spreads particles across every frame of the sheet", () => {
    const rects: Vec4[] = sheetRects(4);
    const node: CPUParticleNode = sheeted(rects, {
      textureSheet: { mode: "randomFrame" },
      seed: 99,
      maxParticles: 200,
    });
    node.emit(200);

    const seen: boolean[] = [false, false, false, false];

    for (let i: number = 0; i < node.aliveCount; i++) {
      seen[frameOf(rects, node, i)] = true;
    }

    expect(seen).toEqual([true, true, true, true]);
  });

  it("falls back to the full rect when the table shrinks below a stored frame", () => {
    const rects: Vec4[] = sheetRects(4);
    const node: CPUParticleNode = sheeted(rects, {
      textureSheet: { mode: "randomFrame" },
      seed: 1,
    });
    node.emit(3);

    expect(frameOf(rects, node, 1)).toEqual(3);

    const single: Vec4[] = [rects[0]];
    node.setFrameRects(single);

    const fallback: Vec4 = node.getFrameRect(1);

    expect(fallback.x).toEqual(0);
    expect(fallback.z).toEqual(1);
    expect(fallback).not.toBe(rects[0]);
  });
});

describe("CPUParticleNode texture sheet absence", () => {
  it("gives every particle one shared full rect when no sheet is configured", () => {
    const node: CPUParticleNode = still();
    node.emit(3);

    const first: Vec4 = node.getFrameRect(0);

    expect(first.x).toEqual(0);
    expect(first.y).toEqual(0);
    expect(first.z).toEqual(1);
    expect(first.w).toEqual(1);
    expect(node.getFrameRect(1)).toBe(first);
    expect(node.getFrameRect(2)).toBe(first);
  });

  it("falls back to the full rect when the frame table is empty", () => {
    const node: CPUParticleNode = still({
      textureSheet: { mode: "overLifetime" },
    });
    node.setFrameRects([]);
    node.emit(1);

    expect(node.frameCount).toEqual(0);

    const rect: Vec4 = node.getFrameRect(0);

    expect(rect.x).toEqual(0);
    expect(rect.z).toEqual(1);
    expect(rect.w).toEqual(1);
  });

  it("returns the full rect for an out of range or non integer index", () => {
    const rects: Vec4[] = sheetRects(4);
    const node: CPUParticleNode = sheeted(rects, {
      textureSheet: { mode: "overLifetime" },
    });
    node.emit(1);

    const shared: Vec4 = node.getFrameRect(-1);

    expect(rects.indexOf(shared)).toEqual(-1);
    expect(shared.z).toEqual(1);
    expect(node.getFrameRect(Number.NaN)).toBe(shared);
    expect(node.getFrameRect(1.5)).toBe(shared);
    expect(node.getFrameRect(node.capacity)).toBe(shared);
  });
});

describe("CPUParticleNode frame table ownership", () => {
  it("copies the rect array so later caller mutations do not reach the node", () => {
    const rects: Vec4[] = sheetRects(4);
    const node: CPUParticleNode = sheeted(rects, {
      textureSheet: { mode: "overLifetime" },
    });
    node.emit(1);

    expect(node.frameCount).toEqual(4);

    rects.length = 0;
    rects.push(new Vec4(9, 9, 9, 9));

    expect(node.frameCount).toEqual(4);
    expect(node.getFrameRect(0).z).toBeCloseTo(0.25, 6);
    expect(node.getFrameRect(0)).not.toBe(rects[0]);
  });
});

describe("CPUParticleNode frame recycling", () => {
  it("moves the frame with the particle when a slot is recycled", () => {
    const rects: Vec4[] = sheetRects(4);
    const node: CPUParticleNode = sheeted(rects, {
      textureSheet: { mode: "randomFrame" },
      seed: 1,
    });

    node.startLifetime = 10;
    node.emit(1);
    node.startLifetime = 0.5;
    node.emit(1);
    node.startLifetime = 10;
    node.emit(1);

    expect(node.aliveCount).toEqual(3);

    const before: number[] = [
      frameOf(rects, node, 0),
      frameOf(rects, node, 1),
      frameOf(rects, node, 2),
    ];

    expect(before[1]).not.toEqual(before[2]);
    expect(before[0]).not.toEqual(before[2]);

    node.advance(1);

    expect(node.aliveCount).toEqual(2);
    expect(frameOf(rects, node, 0)).toEqual(before[0]);
    expect(frameOf(rects, node, 1)).toEqual(before[2]);
  });

  it("keeps and regrows the frame array across a capacity change", () => {
    const rects: Vec4[] = sheetRects(4);
    const node: CPUParticleNode = sheeted(rects, {
      textureSheet: { mode: "randomFrame" },
      seed: 1,
      maxParticles: 4,
    });
    node.emit(4);

    expect(node.aliveCount).toEqual(4);

    const before: number[] = [
      frameOf(rects, node, 0),
      frameOf(rects, node, 1),
      frameOf(rects, node, 2),
      frameOf(rects, node, 3),
    ];

    node.maxParticles = 16;

    expect(node.capacity).toEqual(16);
    expect(node.aliveCount).toEqual(4);

    for (let i: number = 0; i < 4; i++) {
      expect(frameOf(rects, node, i)).toEqual(before[i]);
    }

    node.emit(12);

    expect(node.aliveCount).toEqual(16);

    for (let i: number = 4; i < 16; i++) {
      expect(frameOf(rects, node, i)).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps the surviving prefix of frames when the capacity shrinks", () => {
    const rects: Vec4[] = sheetRects(4);
    const node: CPUParticleNode = sheeted(rects, {
      textureSheet: { mode: "randomFrame" },
      seed: 1,
      maxParticles: 8,
    });
    node.emit(4);

    const before: number[] = [frameOf(rects, node, 0), frameOf(rects, node, 1)];

    node.maxParticles = 2;

    expect(node.capacity).toEqual(2);
    expect(node.aliveCount).toEqual(2);
    expect(frameOf(rects, node, 0)).toEqual(before[0]);
    expect(frameOf(rects, node, 1)).toEqual(before[1]);
  });
});
