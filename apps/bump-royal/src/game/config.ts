import { defineCollisionLayers } from "@atlasjs/gameplay";

export const SortingOrder = {
  Ground: 0,
  Shadow: 5,
  Trail: 10,
  Player: 15,
  PlayerEyes: 20,
} as const;

export const CollisionLayers = defineCollisionLayers("Player", "World");
