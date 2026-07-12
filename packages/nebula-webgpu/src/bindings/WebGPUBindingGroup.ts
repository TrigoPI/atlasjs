import { WebGPUShaderTypeGuard } from "../utils";
import { WebGPUBindingGroupDefinition } from "./WebGPUBindingGroupDefinition";

import {
  BindingGroup,
  BindingGroupProperty,
  BindingValue,
} from "@atlasjs/nebula";

export class WebGPUBindingGroup implements BindingGroup {
  public readonly __kind = "webgpu";
  public readonly definition: WebGPUBindingGroupDefinition;

  /** Bumped on any change — gates uniform buffer re-upload. */
  public version: number;
  /** Bumped only when a resource (texture/sampler) changes — gates bind group rebuild. */
  public resourceVersion: number;

  protected readonly values: Map<string, BindingValue>;

  public constructor(definition: WebGPUBindingGroupDefinition) {
    this.definition = definition;
    this.version = 0;
    this.resourceVersion = 0;
    this.values = new Map<string, BindingValue>();

    this.hydrate();
  }

  public has(name: string): boolean {
    return this.definition.has(name);
  }

  public get<T extends BindingValue = BindingValue>(name: string): T {
    const property: BindingGroupProperty | undefined =
      this.definition.get(name);

    if (!property) {
      throw new Error(`Binding property not found: ${name}`);
    }

    const value: BindingValue | undefined = this.values.get(name);

    if (value === undefined) {
      throw new Error(`Binding value not found: ${name}`);
    }

    return value as T;
  }

  public set(name: string, value: BindingValue): this {
    const property: BindingGroupProperty | undefined =
      this.definition.get(name);

    if (!property) {
      throw new Error(`Binding property not found: ${name}`);
    }

    WebGPUShaderTypeGuard.assertShaderType(property.type, value);

    // No reference-equality short-circuit: a value may be a reused instance
    // mutated in place (e.g. a per-frame model matrix), which `===` cannot
    // detect — skipping it would freeze the GPU-side data. A set() always
    // marks the group dirty.
    this.values.set(name, value);
    this.version++;

    if (property.type === "texture2D" || property.type === "sampler") {
      this.resourceVersion++;
    }

    return this;
  }

  public clone(): WebGPUBindingGroup {
    const clone: WebGPUBindingGroup = new WebGPUBindingGroup(this.definition);

    for (const [key, value] of this.values) {
      clone.values.set(key, value);
    }

    clone.version = this.version;
    clone.resourceVersion = this.resourceVersion;

    return clone;
  }

  public destroy(): void {
    this.values.clear();
  }

  protected hydrate(): void {
    for (const property of this.definition.getProperties()) {
      if (property.defaultValue !== undefined) {
        this.values.set(property.name, property.defaultValue as BindingValue);
      }
    }
  }
}
