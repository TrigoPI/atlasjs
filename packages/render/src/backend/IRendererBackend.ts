import { Box2 } from "@atlasjs/math";
import { RectStyle, RenderSurface } from "../public/types";

import {
  ICameraDriver,
  IContainerDriver,
  IRectDriver,
  ISpriteDriver,
} from "./drivers";

export interface IRendererBackend {
  init(surface: RenderSurface): Promise<void>;
  resize(width: number, height: number, dpr: number): void;

  getCamera(): ICameraDriver;
  root(): IContainerDriver;
  createContainer(): IContainerDriver;
  createRect(style: RectStyle): IRectDriver;
  createSprite(): ISpriteDriver;
  getSurfaceSize(): Box2;

  beginFrame(dt: number): void;
  endFrame(dt: number): void;
  destroy(): void;
}
