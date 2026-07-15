import { Clock } from "@atlasjs/utils";
import type { Camera2D } from "@atlasjs/nebula";

import { WebGPUBindingGroup, WebGPUBindingGroupDefinition } from "../bindings";

export class WebGPUFrameGlobals {
  private readonly globalBindings: WebGPUBindingGroup;
  private readonly clock: Clock;

  public constructor(definition: WebGPUBindingGroupDefinition) {
    this.globalBindings = new WebGPUBindingGroup(definition);
    this.clock = new Clock();
  }

  public get bindings(): WebGPUBindingGroup {
    return this.globalBindings;
  }

  public update(camera: Camera2D, width: number, height: number): void {
    camera.update(width, height);
    this.globalBindings.set("viewProjection", camera.viewProjection);
    this.globalBindings.set("time", this.clock.getTimeSecond());
  }
}
