import { IContainerDriver } from "../../../backend";
import { Node } from "./Node";

export class ContainerNode extends Node<IContainerDriver> {
  public add(child: Node): ContainerNode {
    this.driver.add(child.driver);
    this.renderer.events.emit("node:attached", {
      parentId: this.id,
      childId: child.id,
    });

    return this;
  }

  public remove(child: Node): ContainerNode {
    this.driver.remove(child.driver);
    this.renderer.events.emit("node:detached", {
      parentId: this.id,
      childId: child.id,
    });

    return this;
  }
}
