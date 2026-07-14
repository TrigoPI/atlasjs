import { Color } from "../../utils";
import { TextureFormat } from "../core-types";
import { Texture2D } from "../resources";

export interface RenderTarget extends Texture2D {
  readonly format: TextureFormat;
}

export type RenderTargetDescriptor = {
  readonly width: number;
  readonly height: number;
  readonly format?: TextureFormat;
};

export type PassDescriptor = {
  readonly target?: RenderTarget;
  readonly clear?: Color;
  readonly depth?: boolean;
};
