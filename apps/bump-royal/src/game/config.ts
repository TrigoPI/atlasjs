import { defineCollisionLayers } from "@atlasjs/gameplay";

export const SortingLayer = {
  Ground: "Ground",
  Entities: "Entities",
  Overhead: "Overhead",
} as const;

export const SortingOrder = {
  Player: 10,
} as const;

export const CollisionLayers = defineCollisionLayers("Player", "World");
