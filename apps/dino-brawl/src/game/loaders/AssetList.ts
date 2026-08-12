import { Textures, Audios } from "./ResourcesIndex";

type ResourceDescriptor = { name: string; path: string };

export const TextureList: ResourceDescriptor[] = [
  { name: "texture:blue_dino", path: Textures.BlueDino },
  { name: "texture:green_dino", path: Textures.GreenDino },
  { name: "texture:red_dino", path: Textures.RedDino },
  { name: "texture:yellow_dino", path: Textures.YellowDino },
  { name: "texture:shadow", path: Textures.Shadow },
  { name: "texture:running_particle", path: Textures.RunningParticle },
];

export const SpriteList: ResourceDescriptor[] = [
  { name: "sprite:blue_dino", path: Textures.BlueDino },
  { name: "sprite:green_dino", path: Textures.GreenDino },
  { name: "sprite:red_dino", path: Textures.RedDino },
  { name: "sprite:yellow_dino", path: Textures.YellowDino },
  { name: "sprite:shadow", path: Textures.Shadow },
  { name: "sprite:running_particle", path: Textures.RunningParticle },
];

export const AudioList: ResourceDescriptor[] = [
  { name: "audio:grass_audio", path: Audios.Grass },
];
