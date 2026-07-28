import { defineCollisionLayers } from "@atlasjs/gameplay";

export const SortingLayer = {
  Ground: "Ground",
  Entities: "Entities",
  Overhead: "Overhead",
} as const;

export const SortingOrder = {
  Shadow: 8,
  Player: 10,
  Sword: 20,
} as const;

export const CollisionLayers = defineCollisionLayers("Player", "Occluder");

export const MAP_SCALE: number = 2;
