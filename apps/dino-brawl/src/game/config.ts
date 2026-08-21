import { defineCollisionLayers, type ShakeSpec } from "@atlasjs/gameplay";

export const SortingLayer = {
  Ground: "Ground",
  Entities: "Entities",
  Overhead: "Overhead",
} as const;

export const SortingOrder = {
  Shadow: 8,
  SwordBehind: 9,
  Player: 10,
  Particle: 15,
  SwordFront: 20,
  Impact: 25,
} as const;

export const CollisionLayers = defineCollisionLayers(
  "Player",
  "Occluder",
  "World",
  "Enemy",
  "Weapon",
);

export const MAP_SCALE: number = 2;

export const SWORD_IMPACT_SHAKE: ShakeSpec = {
  strength: 300,
  stiffness: 240,
  damping: 17,
};
