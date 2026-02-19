import { INodeDriver } from "./INodeDriver";

export interface IContainerDriver extends INodeDriver {
  add(child: INodeDriver): void;
  remove(child: INodeDriver): void;
}
