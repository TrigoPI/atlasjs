import Map from "@maps/dino_brawl.json";

import GrassTileset from "@assets/tilesets/ground/grass-tileset.png";
import Props from "@assets/tilesets/props/props.png";

import BlueDino from "@assets/sprites/dinos/dino_blue.png";
import GreenDino from "@assets/sprites/dinos/dino_green.png";
import RedDino from "@assets/sprites/dinos/dino_red.png";
import YellowDino from "@assets/sprites/dinos/dino_yellow.png";

import RunningParticle from "@assets/sprites/particles/dust_cloud_run.png";

import Shadow from "@assets/sprites/props/shadow.png";

import Default from "@assets/sprites/swords/Iicon_32_01.png";

export const ResourcesPath = {
  Map,
  Sprites: {
    Props: {
      Shadow: Shadow,
    },
    Dinos: {
      Blue: BlueDino,
      Green: GreenDino,
      Red: RedDino,
      Yellow: YellowDino,
    },
    Particles: {
      RunningCloud: RunningParticle,
    },
    Swords: {
      Default: Default,
    },
  },
  Tilesets: {
    Ground: {
      Grass: GrassTileset,
    },
    Props: {
      Default: Props,
    },
  },
};
