import { Box2, Vec2Like } from "@atlasjs/math";

export type ViewParams = {
  position: Vec2Like;
  viewport: Box2;
  zoom: number;
  rotation: number;
};
