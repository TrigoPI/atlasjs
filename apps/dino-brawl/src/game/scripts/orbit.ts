import { Vec2 } from "@atlasjs/math";

export function orbitBase(
  anchorWorld: Vec2,
  r: number,
  angle: number,
  angularSpeed: number,
  clock: number,
): Vec2 {
  const theta: number = angle + angularSpeed * clock;
  return Vec2.fromAngle(theta).mult(r).add(anchorWorld);
}
