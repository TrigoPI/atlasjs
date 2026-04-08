import { Disposable } from "../utils";

export interface Sampler extends Disposable {
  readonly __kind: string;
  readonly id: string;
}
