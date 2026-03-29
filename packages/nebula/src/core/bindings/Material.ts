import { Color } from "../../utils";
import { Pipeline } from "../pipeline";
import { Disposable } from "../utils";
import { Texture2D, Sampler } from "../resources";

export interface Material extends Disposable {
  readonly __kind: string;

  readonly pipeline: Pipeline;
  readonly textures: Readonly<Texture2D[]>;
  readonly samplers: Readonly<Sampler[]>;

  bindColor(binding: number): void;
  setColor(binding: number, color: Color): void;
  bindSampler(binding: number, sampler: Sampler): void;
  bindTexture2D(binding: number, texture: Texture2D): void;
}
