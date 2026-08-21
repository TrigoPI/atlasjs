import { Textures, Audios } from "./ResourcesIndex";

type ResourceDescriptor = { name: string; path: string };

export const TextureList: ResourceDescriptor[] = [
  { name: "texture:blue_dino", path: Textures.BlueDino },
  { name: "texture:evil_dino", path: Textures.EvilDino },
  { name: "texture:green_dino", path: Textures.GreenDino },
  { name: "texture:red_dino", path: Textures.RedDino },
  { name: "texture:yellow_dino", path: Textures.YellowDino },
  { name: "texture:shadow", path: Textures.Shadow },
  { name: "texture:running_particle", path: Textures.RunningParticle },
  { name: "texture:impact", path: Textures.Impact },
];

export const SpriteList: ResourceDescriptor[] = [
  { name: "sprite:blue_dino", path: Textures.BlueDino },
  { name: "sprite:evil_dino", path: Textures.EvilDino },
  { name: "sprite:green_dino", path: Textures.GreenDino },
  { name: "sprite:red_dino", path: Textures.RedDino },
  { name: "sprite:yellow_dino", path: Textures.YellowDino },
  { name: "sprite:shadow", path: Textures.Shadow },
  { name: "sprite:running_particle", path: Textures.RunningParticle },
  { name: "sprite:impact", path: Textures.Impact },
  { name: "sprite:default_sword", path: Textures.DefaultSword },
  { name: "sprite:rappier_sword", path: Textures.RappierSword },
];

export const AudioList: ResourceDescriptor[] = [
  { name: "audio:grass_audio", path: Audios.Grass },
  { name: "audio:hit", path: Audios.Hit },
  { name: "audio:woosh_1", path: Audios.Woosh1 },
  { name: "audio:woosh_2", path: Audios.Woosh2 },
  { name: "audio:woosh_3", path: Audios.Woosh3 },
];
