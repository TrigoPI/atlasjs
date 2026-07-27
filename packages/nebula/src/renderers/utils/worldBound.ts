import { Bound, Mat4 } from "@atlasjs/math";

const CORNERS: ReadonlyArray<number> = [
  -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5,
];

export function computeModelWorldBound(model: Mat4, out: Bound): Bound {
  const m: Float32Array = model.buffer;
  const m0: number = m[0];
  const m1: number = m[1];
  const m4: number = m[4];
  const m5: number = m[5];
  const m12: number = m[12];
  const m13: number = m[13];

  let minX: number = Infinity;
  let minY: number = Infinity;
  let maxX: number = -Infinity;
  let maxY: number = -Infinity;

  for (let i: number = 0; i < CORNERS.length; i += 2) {
    const cx: number = CORNERS[i];
    const cy: number = CORNERS[i + 1];
    const px: number = m0 * cx + m4 * cy + m12;
    const py: number = m1 * cx + m5 * cy + m13;

    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  }

  return out.set(minX, minY, maxX - minX, maxY - minY);
}
