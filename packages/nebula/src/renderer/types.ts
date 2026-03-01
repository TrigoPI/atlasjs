import { Texture2D } from "@atlasjs/assets";
import { Mat2 } from "@atlasjs/math";

export type CmdKind = "rect" | "sprite";

export type SurfaceResizeCallback = (w: number, h: number) => void;

export type RenderingSurface = {
  mount: HTMLElement;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  background?: number;
};

export type FillOptions = {
  color: number;
  alpha?: number;
};

export type StrokeOptions = {
  color: number;
  width: number;
  alpha?: number;
};

export type DrawSpriteCmd = {
  kind: "sprite";
  texture: Texture2D;
  world: Mat2;
  alpha?: number;
};

export type DrawRectCmd = {
  kind: "rect";
  world: Mat2;
  width: number;
  height: number;
  fill: FillOptions;
  stroke: StrokeOptions;
};

export type ViewState = {
  view: Mat2;
  invView: Mat2;
};

export type DrawCmd = DrawSpriteCmd | DrawRectCmd;
