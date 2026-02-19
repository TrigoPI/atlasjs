import { IContainerDriver, INodeDriver } from "@atlasjs/render/backend";
import { Container } from "pixi.js";

import { PixiNodeDriver } from "./PixiNodeDriver";

export class PixiContainerDriver
  extends PixiNodeDriver<Container>
  implements IContainerDriver
{
  public constructor() {
    super(new Container());
  }

  public add(child: INodeDriver): void {
    PixiNodeDriver.assertPixi(child);
    this.obj.addChild(child.obj);
  }

  public remove(child: INodeDriver): void {
    PixiNodeDriver.assertPixi(child);
    this.obj.removeChild(child.obj);
  }

  public override destroy(): void {
    this.obj.destroy({ children: true });
  }
}
