import { IRectDriver } from "../../../backend";
import { RectStyle } from "../../types";
import { Node } from "./Node";

export class RectNode extends Node<IRectDriver> {
  public setStyle(patch: Partial<RectStyle>): RectNode {
    this.driver.setStyle(patch);
    return this;
  }
}
