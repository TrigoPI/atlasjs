import { RectStyle, RenderSurface } from "../public/types";
import { IContainerDriver, IRectDriver } from "./drivers";

export interface IRendererBackend {
  init(surface: RenderSurface): Promise<void>;
  resize(width: number, height: number, dpr: number): void;

  root(): IContainerDriver;
  createContainer(): IContainerDriver;
  createRect(style: RectStyle): IRectDriver;

  beginFrame(dt: number): void;
  endFrame(dt: number): void;
  destroy(): void;
}
