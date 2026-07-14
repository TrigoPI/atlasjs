import { Geometry } from "../core/geometry";
import { Material } from "../core/material";
import { BindingGroup } from "../core/bindings";

export type DrawCommand = {
  readonly sortKey: number;
  readonly geometry: Geometry;
  readonly material: Material;
  readonly bindings: BindingGroup;
};
