import { Color } from "@atlasjs/gameplay";

type Rgb = readonly [number, number, number];

/* The wire carries an index into this array, never an RGBA. Re-skinning the players is then a
   client edit, not a protocol change. */
const PALETTE: readonly Rgb[] = [
  [1.0, 0.541, 0.239],
  [0.302, 0.616, 1.0],
  [0.427, 0.875, 0.427],
  [1.0, 0.373, 0.561],
  [1.0, 0.851, 0.239],
  [0.698, 0.427, 1.0],
  [0.239, 0.855, 0.843],
  [1.0, 0.302, 0.302],
];

export const PALETTE_SIZE: number = PALETTE.length;

/* A fresh Color per call: buildPlayerView assigns props.color straight into the SpriteRenderer,
   so a shared instance would let one player's tint follow another's. */
export function playerColor(index: number): Color {
  const wrapped: number =
    ((index % PALETTE_SIZE) + PALETTE_SIZE) % PALETTE_SIZE;
  const rgb: Rgb = PALETTE[wrapped];

  return new Color(rgb[0], rgb[1], rgb[2], 1);
}
