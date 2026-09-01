import { describe, expect, it } from "vitest";
import { Vec2 } from "../src/Vec2";

describe("Vec2.lerp", () => {
  it("leaves the vector unchanged at t = 0", () => {
    const v: Vec2 = new Vec2(1, 2);
    v.lerp(new Vec2(10, 20), 0);
    expect(v.x).toBe(1);
    expect(v.y).toBe(2);
  });

  it("lands exactly on the target at t = 1", () => {
    const v: Vec2 = new Vec2(0.7, 8.7);
    const target: Vec2 = new Vec2(0.1, 0.3);
    v.lerp(target, 1);
    expect(v.x).toBe(0.1);
    expect(v.y).toBe(0.3);
  });

  it("returns the midpoint at t = 0.5", () => {
    const v: Vec2 = new Vec2(0, 0);
    v.lerp(new Vec2(10, 20), 0.5);
    expect(v.x).toBe(5);
    expect(v.y).toBe(10);
  });

  it("clamps t above 1 to the t = 1 result", () => {
    const target: Vec2 = new Vec2(0.1, 0.3);
    const clamped: Vec2 = new Vec2(0.7, 8.7).lerp(target, 4);
    const exact: Vec2 = new Vec2(0.7, 8.7).lerp(target, 1);
    expect(clamped.x).toBe(exact.x);
    expect(clamped.y).toBe(exact.y);
  });

  it("clamps t below 0 to the t = 0 result", () => {
    const target: Vec2 = new Vec2(0.1, 0.3);
    const clamped: Vec2 = new Vec2(0.7, 8.7).lerp(target, -4);
    const exact: Vec2 = new Vec2(0.7, 8.7).lerp(target, 0);
    expect(clamped.x).toBe(exact.x);
    expect(clamped.y).toBe(exact.y);
  });

  it("returns the same instance", () => {
    const v: Vec2 = new Vec2(0, 0);
    expect(v.lerp(new Vec2(10, 10), 0.25)).toBe(v);
  });

  it("never mutates the target", () => {
    const v: Vec2 = new Vec2(0, 0);
    const target: Vec2 = new Vec2(10, 20);
    v.lerp(target, 0.5);
    v.lerp(target, 1);
    expect(target.x).toBe(10);
    expect(target.y).toBe(20);
  });
});
