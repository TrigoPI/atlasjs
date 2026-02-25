import { Box2 } from "@atlasjs/math";
import { RectStyle } from "../../public/types";
import { INodeDriver } from "./INodeDriver";

export interface IRectDriver extends INodeDriver {
  getSize(): Box2;

  setSize(width: number, height: number): void;
  setStyle(patch: Partial<RectStyle>): void;
  setFillColor(color: number): void;
  setFillAlpha(alpha: number): void;
  setStrokeWidth(width: number): void;
  setStrokeColor(color: number): void;
  setStrokeAlpha(alpha: number): void;
}
