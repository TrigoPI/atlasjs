import { defineCollisionLayers } from "@atlasjs/gameplay";

export const SortingOrder = {
  Ground: 0,
  Trail: 5,
  Player: 10,
  PlayerEyes: 15,
} as const;

export const CollisionLayers = defineCollisionLayers("Player", "World");
