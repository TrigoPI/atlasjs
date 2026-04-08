import { PipelineDescriptor } from "../core-types";
import { Disposable } from "../utils";

export interface Pipeline extends Disposable {
  readonly __kind: string;
  readonly id: string;
  readonly descriptor: PipelineDescriptor;
}
