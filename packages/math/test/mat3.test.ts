import { describe, expect, it } from "vitest";

import { Mat3 } from "../src/Mat3";
import { Transform2D } from "../src/Transform2D";
import { Vec2 } from "../src/Vec2";

describe("Mat3", () => {
  it("multiply composes transforms (parent * local) on a point", () => {
    const translate: Mat3 = Mat3.fromTransform2D(new Transform2D(new Vec2(10, 0)));
    const scale: Mat3 = Mat3.fromTransform2D(
      new Transform2D(new Vec2(0, 0), new Vec2(2, 2)),
    );

    const composed: Mat3 = translate.clone().multiply(scale);
    const p: Vec2 = composed.transformPoint2(1, 0);

    expect(p.x).toBeCloseTo(12, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it("static multiply does not mutate its operands", () => {
    const a: Mat3 = Mat3.fromTransform2D(new Transform2D(new Vec2(3, 4)));
    const b: Mat3 = Mat3.identity();

    Mat3.multiply(a, b);

    expect(a.getTranslation().x).toBeCloseTo(3, 6);
    expect(a.getTranslation().y).toBeCloseTo(4, 6);
  });

  it("invert yields identity when composed with the original", () => {
    const m: Mat3 = Mat3.fromTransform2D(
      new Transform2D(new Vec2(5, -3), new Vec2(2, 4), 0.7),
    );
    const id: Mat3 = m.clone().multiply(m.clone().invert());

    expect(id.buffer[0]).toBeCloseTo(1, 5);
    expect(id.buffer[4]).toBeCloseTo(1, 5);
    expect(id.buffer[8]).toBeCloseTo(1, 5);
    expect(id.buffer[1]).toBeCloseTo(0, 5);
    expect(id.buffer[3]).toBeCloseTo(0, 5);
    expect(id.buffer[6]).toBeCloseTo(0, 5);
    expect(id.buffer[7]).toBeCloseTo(0, 5);
  });

  it("decomposes translation, rotation and scale (no shear)", () => {
    const m: Mat3 = Mat3.fromTransform2D(
      new Transform2D(new Vec2(7, 9), new Vec2(3, 2), 0.5),
    );

    expect(m.getTranslation().x).toBeCloseTo(7, 6);
    expect(m.getTranslation().y).toBeCloseTo(9, 6);
    expect(m.getRotation()).toBeCloseTo(0.5, 6);
    expect(m.getScale().x).toBeCloseTo(3, 6);
    expect(m.getScale().y).toBeCloseTo(2, 6);
  });
});
