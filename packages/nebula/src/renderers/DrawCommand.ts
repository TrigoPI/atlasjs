import { Mat4, Vec4 } from "@atlasjs/math";

import { RenderState } from "../core/core-types";
import { Texture2D, Sampler } from "../core/resources";

export type SpriteDrawCommand = {
  readonly kind: "sprite";
  readonly sortingLayer: number;
  readonly sortPrimary: number;
  readonly sortSecondary: number;
  readonly kindOrder: number;
  readonly batchKey: number;
  readonly renderState: RenderState;
  readonly texture: Texture2D;
  readonly sampler: Sampler;
  readonly model: Mat4;
  readonly uvRect: Vec4;
  readonly tint: Vec4;
};

export type ShapeDrawCommand = {
  readonly kind: "shape";
  readonly sortingLayer: number;
  readonly sortPrimary: number;
  readonly sortSecondary: number;
  readonly kindOrder: number;
  readonly batchKey: number;
  readonly renderState: RenderState;
  readonly model: Mat4;
  readonly color: Vec4;
  readonly params: Vec4;
};

export type TileMapDrawCommand = {
  readonly kind: "tilemap";
  readonly sortingLayer: number;
  readonly sortPrimary: number;
  readonly sortSecondary: number;
  readonly kindOrder: number;
  readonly batchKey: number;
  readonly renderState: RenderState;
  readonly texture: Texture2D;
  readonly sampler: Sampler;
  readonly tint: Vec4;
  readonly models: ReadonlyArray<Mat4>;
  readonly uvRects: ReadonlyArray<Vec4>;
  readonly count: number;
};

export type DrawCommand = SpriteDrawCommand | ShapeDrawCommand | TileMapDrawCommand;
