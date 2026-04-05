import { Vec2, Mat4 } from "@atlasjs/math";

import { Color } from "../../utils";
import { Disposable } from "../utils";
import { BindingValue } from "../core-types";
import { Texture2D, Sampler } from "../resources";
import { BindingGroup } from "../bindings";

import { Shader } from "./Shader";

export interface Material extends Disposable {
  readonly __kind: string;
  readonly shader: Shader;
  readonly bindingGroup: BindingGroup;

  has(name: string): boolean;
  get<T extends BindingValue = BindingValue>(name: string): T;
  setNumber(name: string, value: number): this;
  setBoolean(name: string, value: boolean): this;
  setColor(name: string, value: Color): this;
  setVec2(name: string, value: Vec2): this;
  setMat4(name: string, value: Mat4): this;
  setTexture2D(name: string, value: Texture2D | null): this;
  setSampler(name: string, value: Sampler | null): this;
  setBuffer(name: string, value: ArrayBufferView): this;
  clone(): Material;
}
