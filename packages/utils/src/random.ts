export function randomRange(
  min: number,
  max: number,
  rng: () => number = Math.random,
): number {
  return min + rng() * (max - min);
}

export function pickRandom<T>(
  items: readonly T[],
  rng: () => number = Math.random,
): T {
  if (items.length === 0) {
    throw new Error("pickRandom: cannot pick from an empty array");
  }
  const index: number = Math.floor(rng() * items.length);
  return items[index];
}
