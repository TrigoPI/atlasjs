import { DirtyQueue } from "../graph";
import { Node } from "./Node";

export class PolylineNode extends Node {
  public override kind: string;

  public constructor(dirty: DirtyQueue<Node>, id?: string) {
    super(dirty, id);
    this.kind = "polyline";
  }
}
