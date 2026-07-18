import { Resource } from "@atlasjs/assets";

export interface Texture2D extends Resource {
  readonly __kind: string;
  readonly width: number;
  readonly height: number;
}
