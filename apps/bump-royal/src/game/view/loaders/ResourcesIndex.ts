import Bump from "@assets/sounds/bump.wav";
import Fall from "@assets/sounds/fall.wav";

import Players from "@assets/sprites/players.png";
import PlayerEyes from "@assets/sprites/player_eyes.png";
import Shadow from "@assets/sprites/shadow.png";
import Dust from "@assets/sprites/dust.png";
import Arena from "@assets/sprites/arena.png";

export const Textures = {
  Players,
  PlayerEyes,
  Arena,
  Shadow,
  Dust,
} as const;

export const Audios = {
  Bump,
  Fall,
};
