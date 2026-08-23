import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Vec2, Vec4 } from "@atlasjs/math";
import type { RenderState, UniformPropertyLayout } from "@atlasjs/nebula";
import { WebGPUShader } from "../src/material";
import { WebGPUReflection } from "../src/reflect";
import type { WebGPUReflectedStorage } from "../src/reflect";
import { WebGPUTrailBatch } from "../src/batch/WebGPUTrailBatch";

const STATE: RenderState = { blend: "alpha", depthTest: false, cull: "none" };

function readShader(name: string): string {
  return readFileSync(
    new URL(`../src/shaders/${name}`, import.meta.url),
    "utf8",
  );
}

function trailShader(): WebGPUShader {
  const source: string = readShader("trail.wgsl");
  const code: string = `${readShader("global.wgsl")}\n\n${source}`;

  return new WebGPUShader(
    {} as GPUShaderModule,
    {
      id: "atlas.webgpu.trail",
      source,
      vertexEntryPoint: "vs_main",
      fragmentEntryPoint: "fs_main",
    },
    WebGPUReflection.reflect(code),
  );
}

describe("WebGPUTrailBatch", () => {
  it("empaquette un segment en 64 octets, membres dans l'ordre du shader", () => {
    const batch: WebGPUTrailBatch = new WebGPUTrailBatch(trailShader());

    batch.begin(STATE);
    batch.add(
      new Vec2(1, 2),
      new Vec2(3, 4),
      new Vec2(5, 6),
      new Vec2(7, 8),
      new Vec4(0.1, 0.2, 0.3, 0.4),
      new Vec4(0.5, 0.6, 0.7, 0.8),
    );

    expect(batch.count).toBe(1);
    expect(batch.byteSize).toBe(64);

    const packed: Float32Array = new Float32Array(batch.pack());

    expect([...packed.slice(0, 8)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(
      [...packed.slice(8, 12)].map((v: number) => Math.round(v * 10)),
    ).toEqual([1, 2, 3, 4]);
    expect(
      [...packed.slice(12, 16)].map((v: number) => Math.round(v * 10)),
    ).toEqual([5, 6, 7, 8]);
  });

  it("remet le compteur à zéro à chaque begin", () => {
    const batch: WebGPUTrailBatch = new WebGPUTrailBatch(trailShader());
    const zero: Vec2 = new Vec2(0, 0);
    const white: Vec4 = new Vec4(1, 1, 1, 1);

    batch.begin(STATE);
    batch.add(zero, zero, zero, zero, white, white);
    batch.begin(STATE);

    expect(batch.count).toBe(0);
  });

  it("packs the shared joint Vec2 instances by reading their live values, keeping two adjacent segments byte-identical", () => {
    const batch: WebGPUTrailBatch = new WebGPUTrailBatch(trailShader());
    const storage: WebGPUReflectedStorage | undefined =
      batch.shader.objectDefinition.storage;

    if (!storage) {
      throw new Error("expected the trail shader to declare a storage buffer");
    }

    const offsetOf = (name: string): number => {
      const member: UniformPropertyLayout | undefined = storage.members.find(
        (candidate: UniformPropertyLayout) => candidate.name === name,
      );

      if (!member) {
        throw new Error(`expected a "${name}" member in the storage layout`);
      }

      return member.offset;
    };

    const white: Vec4 = new Vec4(1, 1, 1, 1);
    const p0: Vec2 = new Vec2(0, 0);
    const p1: Vec2 = new Vec2(10, 20);
    const p2: Vec2 = new Vec2(30, 40);
    const e0: Vec2 = new Vec2(1, 1);
    const e1: Vec2 = new Vec2(2, 3);
    const e2: Vec2 = new Vec2(4, 5);

    batch.begin(STATE);
    batch.add(p0, p1, e0, e1, white, white);

    p1.set(999, 888);
    e1.set(777, 666);

    batch.add(p1, p2, e1, e2, white, white);

    expect(batch.count).toBe(2);
    expect(storage.stride).toBe(64);
    expect(batch.byteSize).toBe(128);

    const packed: Float32Array = new Float32Array(batch.pack());
    const floatsPerSegment: number =
      storage.stride / Float32Array.BYTES_PER_ELEMENT;

    const readVec2 = (segment: number, name: string): [number, number] => {
      const base: number =
        segment * floatsPerSegment +
        offsetOf(name) / Float32Array.BYTES_PER_ELEMENT;

      return [packed[base], packed[base + 1]];
    };

    expect(readVec2(0, "posB")).toEqual([999, 888]);
    expect(readVec2(1, "posA")).toEqual([999, 888]);
    expect(readVec2(0, "edgeB")).toEqual([777, 666]);
    expect(readVec2(1, "edgeA")).toEqual([777, 666]);

    expect(readVec2(1, "posA")).toEqual(readVec2(0, "posB"));
    expect(readVec2(1, "edgeA")).toEqual(readVec2(0, "edgeB"));
  });
});
