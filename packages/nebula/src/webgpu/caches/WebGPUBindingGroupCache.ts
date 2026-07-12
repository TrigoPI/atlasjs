import { Disposable } from "../../core";
import {
  WebGPUBindingGroup,
  WebGPUBindingGroupDefinition,
  WebGPUBindingGroupLayout,
  WebGPUCompiledBindingGroup,
} from "../bindings";

export class WebGPUBindingGroupCache implements Disposable {
  private readonly device: GPUDevice;

  private compiledRefs: Set<WebGPUCompiledBindingGroup>;
  private compiled: WeakMap<WebGPUBindingGroup, WebGPUCompiledBindingGroup>;
  private layouts: WeakMap<WebGPUBindingGroupDefinition, WebGPUBindingGroupLayout>;

  public constructor(device: GPUDevice) {
    this.device = device;
    this.compiledRefs = new Set();
    this.layouts = new WeakMap();
    this.compiled = new WeakMap();
  }

  public getOrCreateLayout(
    definition: WebGPUBindingGroupDefinition,
  ): WebGPUBindingGroupLayout {
    let layout: WebGPUBindingGroupLayout | undefined =
      this.layouts.get(definition);

    if (!layout) {
      layout = new WebGPUBindingGroupLayout(definition);
      this.layouts.set(definition, layout);
    }

    return layout;
  }

  public get(
    bindingGroup: WebGPUBindingGroup,
    bindGroupLayout: GPUBindGroupLayout,
  ): WebGPUCompiledBindingGroup {
    let compiled: WebGPUCompiledBindingGroup | undefined =
      this.compiled.get(bindingGroup);

    if (!compiled) {
      const layout: WebGPUBindingGroupLayout = this.getOrCreateLayout(
        bindingGroup.definition,
      );

      compiled = new WebGPUCompiledBindingGroup(
        this.device,
        bindingGroup,
        layout,
        bindGroupLayout,
      );

      this.compiled.set(bindingGroup, compiled);
      this.compiledRefs.add(compiled);
    }

    compiled.update();
    return compiled;
  }

  public delete(bindingGroup: WebGPUBindingGroup): void {
    const compiled: WebGPUCompiledBindingGroup | undefined =
      this.compiled.get(bindingGroup);

    if (!compiled) {
      return;
    }

    compiled.destroy();
    this.compiled.delete(bindingGroup);
    this.compiledRefs.delete(compiled);
  }

  public clear(): void {
    for (const compiled of this.compiledRefs) {
      compiled.destroy();
    }

    this.compiledRefs.clear();
    this.compiled = new WeakMap();
    this.layouts = new WeakMap();
  }

  public destroy(): void {
    this.clear();
  }
}
