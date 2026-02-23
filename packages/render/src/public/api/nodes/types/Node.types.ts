import { Mat2, Transform2DLike } from "@atlasjs/math";
import { Observable } from "@atlasjs/utils";

import { INodeDriver, IRendererBackend } from "../../../../backend";
import { RendererLike } from "../../../../internal";
import { Node } from "../Node";

export type NodeConstructorOptions<TDriver extends INodeDriver> = {
  id?: string;
  isRoot?: boolean;
  driver: TDriver;
  renderer: RendererLike;
  backend: IRendererBackend;
  transform: Transform2DLike;
  dirtyObserver: Observable<Node>;
  localMatrix: Mat2;
  worldMatrix: Mat2;
};
