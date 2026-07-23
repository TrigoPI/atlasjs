import { Vec4 } from "@atlasjs/math";

import type { BlendMode, Sampler, Texture2D } from "../core";
import { Node } from "./Node";

export interface TileInstance {
  x: number;
  y: number;
  width: number;
  height: number;
  uvRect: Vec4;
}

export class TileMapNode extends Node {
  public texture: Texture2D | null;
  public sampler?: Sampler;
  public blend: BlendMode;
  public tint: Vec4;
  public instances: TileInstance[];

  public constructor() {
    super();
    this.texture = null;
    this.blend = "alpha";
    this.tint = new Vec4(1, 1, 1, 1);
    this.instances = [];
  }
}
