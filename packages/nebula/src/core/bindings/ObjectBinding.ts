import { Mat4 } from "@atlasjs/math";
import { Disposable } from "../utils";
import { Bindings } from "./Bindings";

export interface ObjectBinding extends Disposable {
  readonly bindings: Bindings;
  bindMat4At(binding: number): void;
  setMat4At(binding: number, mat: Mat4): void;
  bindVec4At(binding: number): void;
  setVec4At(binding: number, value: Float32Array): void;
}
