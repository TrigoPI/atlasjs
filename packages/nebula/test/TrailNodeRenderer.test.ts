import { describe, expect, it } from "vitest";
import { Bound, Vec2, Vec4 } from "@atlasjs/math";
import { TrailNode } from "../src/graphics/TrailNode";
import { TrailNodeRenderer } from "../src/renderers/TrailNodeRenderer";
import { TrailBatcher } from "../src/renderers/Batchers";
import type { TrailDrawCommand } from "../src/renderers/DrawCommand";
import type { RenderState, TrailBatch } from "../src/core";

const WIDE: Bound = new Bound(-10_000, -10_000, 20_000, 20_000);

type Entry = {
  posA: Vec2;
  posB: Vec2;
  edgeA: Vec2;
  edgeB: Vec2;
  colorA: Vec4;
  colorB: Vec4;
};

class RecordingTrailBatch implements TrailBatch {
  public readonly __kind: string = "test";
  public readonly entries: Entry[] = [];
  public renderState: RenderState = {
    blend: "alpha",
    depthTest: false,
    cull: "none",
  };

  public get count(): number {
    return this.entries.length;
  }

  public begin(renderState: RenderState): void {
    this.entries.length = 0;
    this.renderState = renderState;
  }

  public add(
    posA: Vec2,
    posB: Vec2,
    edgeA: Vec2,
    edgeB: Vec2,
    colorA: Vec4,
    colorB: Vec4,
  ): void {
    this.entries.push({ posA, posB, edgeA, edgeB, colorA, colorB });
  }

  public destroy(): void {}
}

function trailOf(points: ReadonlyArray<readonly [number, number]>): TrailNode {
  const node: TrailNode = new TrailNode();
  node.minVertexDistance = 1;
  node.time = 100;

  for (const [x, y] of points) {
    node.emit(x, y);
  }

  node.updateWorldMatrix();
  return node;
}

function collect(
  node: TrailNode,
  viewport: Bound = WIDE,
): TrailDrawCommand | null {
  return new TrailNodeRenderer().collect(
    node,
    viewport,
    new Bound(),
  ) as TrailDrawCommand | null;
}

function record(command: TrailDrawCommand): RecordingTrailBatch {
  const batch: RecordingTrailBatch = new RecordingTrailBatch();
  const batcher: TrailBatcher = new TrailBatcher(batch);

  batcher.begin(command);
  batcher.add(command);

  return batch;
}

describe("TrailNodeRenderer.collect", () => {
  it("draws nothing below two points", () => {
    expect(collect(trailOf([]))).toBeNull();
    expect(collect(trailOf([[0, 0]]))).toBeNull();
  });

  it("produces a command carrying the points, head at index 0", () => {
    const command: TrailDrawCommand | null = collect(
      trailOf([
        [0, 0],
        [10, 0],
        [20, 0],
      ]),
    );

    expect(command).not.toBeNull();
    const cmd: TrailDrawCommand = command as TrailDrawCommand;
    expect(cmd.kind).toBe("trail");
    expect(cmd.pointCount).toBe(3);
    expect(cmd.positions[0].x).toBe(20);
    expect(cmd.positions[2].x).toBe(0);
  });

  it("culls the trail outside the viewport", () => {
    const node: TrailNode = trailOf([
      [0, 0],
      [10, 0],
    ]);
    expect(collect(node, new Bound(5_000, 5_000, 100, 100))).toBeNull();
  });

  it("does not cull a joint whose miter exceeds the half-width", () => {
    const node: TrailNode = trailOf([
      [0, 0],
      [20, 0],
      [0, 0.001],
    ]);
    node.startWidth = 10;
    node.endWidth = 10;

    const viewport: Bound = new Bound(29, -50, 3, 100);

    expect(collect(node, viewport)).not.toBeNull();
  });

  it("carries the start half-width onto the head's edge", () => {
    const node: TrailNode = trailOf([
      [0, 0],
      [10, 0],
      [20, 0],
    ]);
    node.startWidth = 8;
    node.endWidth = 0;

    const cmd: TrailDrawCommand = collect(node) as TrailDrawCommand;

    expect(Math.hypot(cmd.edges[0].x, cmd.edges[0].y)).toBeCloseTo(4);
    expect(Math.hypot(cmd.edges[2].x, cmd.edges[2].y)).toBeCloseTo(0);
  });

  it("interpolates the color from head to tail", () => {
    const node: TrailNode = trailOf([
      [0, 0],
      [10, 0],
      [20, 0],
    ]);
    node.startColor.set(1, 0, 0, 1);
    node.endColor.set(0, 0, 1, 0);

    const cmd: TrailDrawCommand = collect(node) as TrailDrawCommand;

    expect(cmd.colors[0].x).toBeCloseTo(1);
    expect(cmd.colors[0].w).toBeCloseTo(1);
    expect(cmd.colors[2].z).toBeCloseTo(1);
    expect(cmd.colors[2].w).toBeCloseTo(0);
  });

  it("clamps the miter on a 180-degree fold, without NaN", () => {
    const node: TrailNode = trailOf([
      [0, 0],
      [20, 0],
      [0, 0.001],
    ]);
    node.startWidth = 10;
    node.endWidth = 10;

    const cmd: TrailDrawCommand = collect(node) as TrailDrawCommand;

    for (const edge of cmd.edges) {
      expect(Number.isFinite(edge.x)).toBe(true);
      expect(Number.isFinite(edge.y)).toBe(true);
      expect(Math.hypot(edge.x, edge.y)).toBeLessThanOrEqual(10.001);
    }
  });

  it("stays finite on a zero-length segment (coincident points)", () => {
    const node: TrailNode = new TrailNode();
    node.minVertexDistance = 0;
    node.time = 100;
    node.emit(5, 5);
    node.emit(5, 5);
    node.updateWorldMatrix();

    expect(node.pointCount).toBe(2);
    expect(node.getPointX(0)).toBe(node.getPointX(1));
    expect(node.getPointY(0)).toBe(node.getPointY(1));

    const cmd: TrailDrawCommand = collect(node) as TrailDrawCommand;

    for (const edge of cmd.edges) {
      expect(Number.isFinite(edge.x)).toBe(true);
      expect(Number.isFinite(edge.y)).toBe(true);
    }
  });
});

describe("TrailNodeRenderer batchKey", () => {
  it("groups two trails with the same blend under the same key", () => {
    const renderer: TrailNodeRenderer = new TrailNodeRenderer();
    const a: TrailNode = trailOf([
      [0, 0],
      [10, 0],
    ]);
    const b: TrailNode = trailOf([
      [0, 0],
      [10, 0],
    ]);
    a.blend = "additive";
    b.blend = "additive";

    const cmdA: TrailDrawCommand = renderer.collect(
      a,
      WIDE,
      new Bound(),
    ) as TrailDrawCommand;
    const cmdB: TrailDrawCommand = renderer.collect(
      b,
      WIDE,
      new Bound(),
    ) as TrailDrawCommand;

    expect(cmdA.batchKey).toBe(cmdB.batchKey);
  });

  it("separates two trails with different blends", () => {
    const renderer: TrailNodeRenderer = new TrailNodeRenderer();
    const a: TrailNode = trailOf([
      [0, 0],
      [10, 0],
    ]);
    const b: TrailNode = trailOf([
      [0, 0],
      [10, 0],
    ]);
    a.blend = "additive";
    b.blend = "alpha";

    const cmdA: TrailDrawCommand = renderer.collect(
      a,
      WIDE,
      new Bound(),
    ) as TrailDrawCommand;
    const cmdB: TrailDrawCommand = renderer.collect(
      b,
      WIDE,
      new Bound(),
    ) as TrailDrawCommand;

    expect(cmdA.batchKey).not.toBe(cmdB.batchKey);
  });
});

describe("TrailBatcher", () => {
  it("emits one segment per pair of consecutive points", () => {
    const cmd: TrailDrawCommand = collect(
      trailOf([
        [0, 0],
        [10, 0],
        [20, 0],
        [30, 0],
      ]),
    ) as TrailDrawCommand;
    expect(record(cmd).entries).toHaveLength(3);
  });

  it("shares the joint edge between two neighboring segments", () => {
    const cmd: TrailDrawCommand = collect(
      trailOf([
        [0, 0],
        [20, 0],
        [20, 20],
      ]),
    ) as TrailDrawCommand;
    const entries: Entry[] = record(cmd).entries;

    expect(entries).toHaveLength(2);
    expect(entries[0].edgeB).toBe(entries[1].edgeA);
    expect(entries[0].posB).toBe(entries[1].posA);
    expect(entries[0].colorB).toBe(entries[1].colorA);
  });
});
