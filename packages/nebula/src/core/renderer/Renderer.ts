import { Bound, Box2 } from "@atlasjs/math";

import { Camera2D } from "../camera";
import { Geometry } from "../geometry";
import { Disposable } from "../utils";
import { Material } from "../material";
import { BindingGroup } from "../bindings";

import { ResourceFactory } from "./ResourceFactory";

export interface Renderer extends Disposable, ResourceFactory {
  readonly __kind: string;
  readonly camera: Camera2D;

  init(): Promise<void>;

  getCameraViewport(): Bound;
  getViewport(): Box2;
  beginFrame(): void;
  endFrame(): void;
  draw(geometry: Geometry, material: Material, bindings: BindingGroup): void;
}
