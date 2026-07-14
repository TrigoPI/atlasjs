import { Mat4 } from "@atlasjs/math";

export interface Camera {
  readonly viewProjection: Mat4;
  update(width: number, height: number): void;
}
