import { Disposable } from "../utils";

export interface Shader extends Disposable {
  readonly __kind: string;
  readonly id: string;
  readonly source: string;
  readonly vertexEntryPoint: string;
  readonly fragmentEntryPoint: string;
}
