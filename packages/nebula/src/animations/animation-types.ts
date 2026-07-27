import { Vec2 } from "@atlasjs/math";
import { Texture2D } from "../core";
import { Frame } from "./Frame";

export type FromGridOptions = {
  name: string;
  texture: Texture2D;
  frameWidth: number;
  frameHeight: number;
  spacing?: number;
  margin?: number;
  pivot?: Vec2;
};

export type FromAutoGridOptions = {
  name: string;
  texture: Texture2D;
  rows: number;
  columns: number;
  pivot?: Vec2;
};

export type SpriteAnimationOptions = {
  frames: Frame[];
  fps: number;
  loop?: boolean;
  autoPlay?: boolean;
};
