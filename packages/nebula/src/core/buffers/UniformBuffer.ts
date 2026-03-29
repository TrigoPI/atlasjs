import { Disposable } from "../utils";

export interface UniformBuffer extends Disposable {
  readonly __kind: string;
  readonly size: number;
  setData(data: Float32Array): void;
}
