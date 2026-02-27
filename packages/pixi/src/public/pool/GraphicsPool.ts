import { Graphics } from "pixi.js";
import { Pool } from "./Pool";

export class GraphicsPool extends Pool<Graphics> {
  protected createNew(): Graphics {
    return new Graphics();
  }

  protected afterVisible(g: Graphics): void {
    g.clear();
  }
}
