// Dino
import BlueDino from "@assets/sprites/dinos/dino_blue.png";
import EvilDino from "@assets/sprites/dinos/dino_evil.png";
import GreenDino from "@assets/sprites/dinos/dino_green.png";
import RedDino from "@assets/sprites/dinos/dino_red.png";
import YellowDino from "@assets/sprites/dinos/dino_yellow.png";
import Shadow from "@assets/sprites/props/shadow.png";

// Effect
import Impact from "@assets/sprites/particles/impact.png";
import RunningParticle from "@assets/sprites/particles/dust_cloud_run.png";

// Sword
import DefaultSword from "@assets/sprites/swords/default_sword.png";
import RappierSword from "@assets/sprites/swords/rappier_sword.png";

// Audio
import Grass from "@assets/audio/grass.wav";
import Hit from "@assets/audio/hit.wav";
import Woosh1 from "@assets/audio/swords/woosh_1.wav";
import Woosh2 from "@assets/audio/swords/woosh_2.wav";
import Woosh3 from "@assets/audio/swords/woosh_3.wav";

export const Textures = {
  BlueDino,
  EvilDino,
  GreenDino,
  RedDino,
  YellowDino,
  Shadow,
  RunningParticle,
  Impact,
  DefaultSword,
  RappierSword,
} as const;

export const Audios = {
  Grass,
  Hit,
  Woosh1,
  Woosh2,
  Woosh3,
} as const;
