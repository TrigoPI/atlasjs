// Dino
import BlueDino from "@assets/sprites/dinos/dino_blue.png";
import GreenDino from "@assets/sprites/dinos/dino_green.png";
import RedDino from "@assets/sprites/dinos/dino_red.png";
import YellowDino from "@assets/sprites/dinos/dino_yellow.png";
import Shadow from "@assets/sprites/props/shadow.png";

// Effect
import RunningParticle from "@assets/sprites/particles/dust_cloud_run.png";

// Sword
import DefaultSword from "@assets/sprites/swords/default_sword.png";

// Audio
import Grass from "@assets/audio/grass.mp3";

export const Textures = {
  BlueDino,
  GreenDino,
  RedDino,
  YellowDino,
  Shadow,
  RunningParticle,
  DefaultSword,
} as const;

export const Audios = {
  Grass,
} as const;
