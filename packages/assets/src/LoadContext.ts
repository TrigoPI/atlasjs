import { Asset } from "./Asset";
import { Resource } from "./Resource";

export interface LoadContext {
  load<R extends Resource>(asset: Asset): Promise<R>;
}
