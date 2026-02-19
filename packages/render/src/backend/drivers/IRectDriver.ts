import { RectStyle } from "../../public/types";
import { INodeDriver } from "./INodeDriver";

export interface IRectDriver extends INodeDriver {
  setStyle(patch: Partial<RectStyle>): void;
}
