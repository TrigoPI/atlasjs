import { Bound, Box2 } from "@atlasjs/math";

import { Camera } from "../camera";
import { Geometry } from "../geometry";
import { Disposable } from "../utils";
import { Material } from "../material";
import { BindingGroup } from "../bindings";

import { ResourceFactory } from "./ResourceFactory";
import { SpriteBatch } from "./SpriteBatch";
import { PassDescriptor } from "./RenderTarget";

export interface Renderer extends Disposable, ResourceFactory {
  readonly __kind: string;
  readonly camera: Camera;

  init(): Promise<void>;

  getCameraViewport(): Bound;
  getViewport(): Box2;
  beginFrame(pass?: PassDescriptor): void;
  endFrame(): void;
  draw(geometry: Geometry, material: Material, bindings: BindingGroup): void;
  drawSpriteBatch(batch: SpriteBatch): void;
}
