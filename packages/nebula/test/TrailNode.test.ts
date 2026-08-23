import { describe, expect, it } from "vitest";
import { TrailNode } from "../src/graphics/TrailNode";

describe("TrailNode.emit", () => {
  it("creates the first point at the emitted position", () => {
    const node: TrailNode = new TrailNode();
    node.emit(10, 20);

    expect(node.pointCount).toBe(1);
    expect(node.getPointX(0)).toBe(10);
    expect(node.getPointY(0)).toBe(20);
  });

  it("moves the head without committing a point below minVertexDistance", () => {
    const node: TrailNode = new TrailNode();
    node.minVertexDistance = 5;
    node.emit(0, 0);
    node.emit(1, 0);
    node.emit(2, 0);

    expect(node.pointCount).toBe(1);
    expect(node.getPointX(0)).toBe(2);
  });

  it("commits a new point beyond minVertexDistance, head at index 0", () => {
    const node: TrailNode = new TrailNode();
    node.minVertexDistance = 5;
    node.emit(0, 0);
    node.emit(10, 0);

    expect(node.pointCount).toBe(2);
    expect(node.getPointX(0)).toBe(10);
    expect(node.getPointX(1)).toBe(0);
  });

  it("resets the head's age to zero when it moves", () => {
    const node: TrailNode = new TrailNode();
    node.minVertexDistance = 5;
    node.time = 0.2;

    node.emit(0, 0);
    node.advance(0.15);
    node.emit(1, 0);

    expect(node.getPointAge(0)).toBe(0);

    node.advance(0.15);

    expect(node.pointCount).toBe(1);
    expect(node.getPointAge(0)).toBeCloseTo(0.15);
  });
});

describe("TrailNode.advance", () => {
  it("evicts from the tail the points older than time", () => {
    const node: TrailNode = new TrailNode();
    node.minVertexDistance = 5;
    node.time = 0.2;

    node.emit(0, 0);
    node.advance(0.15);
    node.emit(10, 0);
    node.advance(0.1);

    expect(node.pointCount).toBe(1);
    expect(node.getPointX(0)).toBe(10);
  });

  it("empties the trail entirely once everything has expired", () => {
    const node: TrailNode = new TrailNode();
    node.minVertexDistance = 5;
    node.time = 0.2;

    node.emit(0, 0);
    node.emit(10, 0);
    node.advance(0.5);

    expect(node.pointCount).toBe(0);
  });
});

describe("TrailNode capacity", () => {
  it("drops the oldest point when the buffer is full", () => {
    const node: TrailNode = new TrailNode(3);
    node.minVertexDistance = 1;
    node.time = 10;

    node.emit(0, 0);
    node.emit(10, 0);
    node.emit(20, 0);
    node.emit(30, 0);

    expect(node.pointCount).toBe(3);
    expect(node.getPointX(0)).toBe(30);
    expect(node.getPointX(2)).toBe(10);
  });

  it("setCapacity keeps the most recent points and clamps to 2", () => {
    const node: TrailNode = new TrailNode(8);
    node.minVertexDistance = 1;
    node.time = 10;

    node.emit(0, 0);
    node.emit(10, 0);
    node.emit(20, 0);
    node.setCapacity(2);

    expect(node.capacity).toBe(2);
    expect(node.pointCount).toBe(2);
    expect(node.getPointX(0)).toBe(20);
    expect(node.getPointX(1)).toBe(10);

    node.setCapacity(1);
    expect(node.capacity).toBe(2);
  });

  it("clear resets the trail to empty", () => {
    const node: TrailNode = new TrailNode();
    node.emit(0, 0);
    node.clear();

    expect(node.pointCount).toBe(0);
  });

  it("falls back to the minimum capacity when constructed with a non-finite value", () => {
    const node: TrailNode = new TrailNode(NaN);

    expect(node.capacity).toBe(2);

    node.emit(1, 2);

    expect(node.pointCount).toBe(1);
    expect(node.getPointX(0)).toBe(1);
    expect(node.getPointY(0)).toBe(2);
  });

  it("falls back to the minimum capacity when setCapacity is given a non-finite value", () => {
    const node: TrailNode = new TrailNode(8);
    node.setCapacity(Infinity);

    expect(node.capacity).toBe(2);

    node.emit(1, 2);

    expect(node.pointCount).toBe(1);
    expect(node.getPointX(0)).toBe(1);
    expect(node.getPointY(0)).toBe(2);
  });
});
