import { Textures } from "./ResourcesIndex";

type ResourceDescriptor = { name: string; path: string };

export const SpriteList = [
  { name: "sprite:player", path: Textures.Player },
] as const satisfies readonly ResourceDescriptor[];

export type AssetName = (typeof SpriteList)[number]["name"];
