import { Material, ObjectBinding } from "../bindings";
import { Camera2D } from "../camera/Camera2D";
import { Geometry } from "../geometry";
import { Pipeline } from "../pipeline";
import { Disposable } from "../utils";
import { ResourceFactory } from "./ResourceFactory";

export interface Renderer extends Disposable, ResourceFactory {
  readonly __kind: string;
  readonly camera: Camera2D;

  init(): Promise<void>;
  beginFrame(): void;
  endFrame(): void;
  draw(
    geometry: Geometry,
    pipeline: Pipeline,
    material: Material,
    bindings: ObjectBinding,
  ): void;
}
