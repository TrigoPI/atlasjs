export type CollisionLayer = number;
export type CollisionMask = number;

export const ALL_LAYERS: CollisionMask = 0xffff;
export const NO_LAYERS: CollisionMask = 0x0000;

export type CollisionLayers<K extends string> = {
  readonly [P in K]: CollisionLayer;
};

export function defineCollisionLayers<const K extends string>(
  ...names: K[]
): CollisionLayers<K> {
  if (names.length > 16) {
    throw new Error(
      `defineCollisionLayers supports at most 16 layers, received ${names.length}.`,
    );
  }

  const layers: Record<string, CollisionLayer> = {};

  for (let i: number = 0; i < names.length; i++) {
    layers[names[i]] = 1 << i;
  }

  return layers as CollisionLayers<K>;
}
