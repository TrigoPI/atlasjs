import { Asset } from "./Asset";
import { Resource } from "./Resource";
import { LoadContext } from "./LoadContext";

export interface AssetLoader<A extends Asset, R extends Resource> {
  readonly type: string;
  load(asset: A, ctx: LoadContext): Promise<R>;
}
