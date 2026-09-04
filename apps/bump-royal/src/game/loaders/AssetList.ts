import { Audios, Textures } from "./ResourcesIndex";

type ResourceDescriptor = { name: string; path: string };

export const SpriteList = [
  { name: "sprite:players", path: Textures.Players },
  { name: "sprite:player_eyes", path: Textures.PlayerEyes },
  { name: "sprite:arena", path: Textures.Arena },
] as const satisfies readonly ResourceDescriptor[];

export const AudioList = [
  { name: "audio:bump", path: Audios.Bump },
] as const satisfies readonly ResourceDescriptor[];

export type AssetName =
  | (typeof SpriteList)[number]["name"]
  | (typeof AudioList)[number]["name"];
