import { Mat4, Vec2 } from "@atlasjs/math";

import { Color } from "../../utils";
import { Disposable } from "../utils";
import { Sampler, Texture2D } from "../resources";
import { BindingValue } from "../core-types";

import { BindingGroupDefinition } from "./BindingGroupDefinition";

export interface BindingGroup extends Disposable {
  readonly __kind: string;
  readonly definition: BindingGroupDefinition;
  readonly version: number;

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
  clone(): BindingGroup;
}
