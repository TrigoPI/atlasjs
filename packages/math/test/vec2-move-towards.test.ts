import { describe, expect, it } from "vitest";
import { Vec2 } from "../src/Vec2";

describe("Vec2.moveTowards", () => {
  it("advances exactly maxDelta when the target is further away", () => {
    const v: Vec2 = new Vec2(0, 0);
    const target: Vec2 = new Vec2(30, 40);
    v.moveTowards(target, 5);
    expect(v.mag()).toBeCloseTo(5);
    expect(v.x).toBeCloseTo(3);
    expect(v.y).toBeCloseTo(4);
  });

  it("keeps the direction pointing at the target after a partial step", () => {
    const v: Vec2 = new Vec2(2, -6);
    const target: Vec2 = new Vec2(10, 2);
    const before: number = Vec2.angle(v, target);
    v.moveTowards(target, 1);
    expect(Vec2.angle(v, target)).toBeCloseTo(before);
    expect(Vec2.sub(target, v).mag()).toBeCloseTo(Math.sqrt(8 * 8 + 8 * 8) - 1);
  });

  it("snaps exactly to the target without overshooting when dist < maxDelta", () => {
    const v: Vec2 = new Vec2(0.7, 8.7);
    const target: Vec2 = new Vec2(0.1, 0.3);
    v.moveTowards(target, 1000);
    expect(v.x).toBe(0.1);
    expect(v.y).toBe(0.3);
  });

  it("lands exactly on the target when dist === maxDelta", () => {
    const v: Vec2 = new Vec2(0, 0);
    const target: Vec2 = new Vec2(3, 4);
    v.moveTowards(target, 5);
    expect(v.x).toBe(3);
    expect(v.y).toBe(4);
  });

  it("is a no-op and produces no NaN when already on the target", () => {
    const v: Vec2 = new Vec2(7, -3);
    const target: Vec2 = new Vec2(7, -3);
    v.moveTowards(target, 10);
    expect(v.x).toBe(7);
    expect(v.y).toBe(-3);
    expect(Number.isNaN(v.x)).toBe(false);
    expect(Number.isNaN(v.y)).toBe(false);
  });

  it("is a no-op when maxDelta is 0", () => {
    const v: Vec2 = new Vec2(1, 2);
    v.moveTowards(new Vec2(100, 200), 0);
    expect(v.x).toBe(1);
    expect(v.y).toBe(2);
  });

  it("is a no-op on a negative maxDelta instead of moving away", () => {
    const v: Vec2 = new Vec2(1, 2);
    v.moveTowards(new Vec2(100, 200), -5);
    expect(v.x).toBe(1);
    expect(v.y).toBe(2);
  });

  it("returns the same instance", () => {
    const v: Vec2 = new Vec2(0, 0);
    expect(v.moveTowards(new Vec2(10, 10), 1)).toBe(v);
  });

  it("never mutates the target", () => {
    const v: Vec2 = new Vec2(0, 0);
    const target: Vec2 = new Vec2(10, 20);
    v.moveTowards(target, 1);
    v.moveTowards(target, 1000);
    expect(target.x).toBe(10);
    expect(target.y).toBe(20);
  });
});
