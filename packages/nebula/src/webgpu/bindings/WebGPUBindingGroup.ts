import { WebGPUShaderTypeGuard } from "../utils";
import { WebGPUBindingGroupDefinition } from "./WebGPUBindingGroupDefinition";

import {
  BindingGroup,
  BindingGroupProperty,
  BindingValue,
} from "../../core";

export class WebGPUBindingGroup implements BindingGroup {
  public readonly __kind = "webgpu";
  public readonly definition: WebGPUBindingGroupDefinition;
  public version: number;

  protected readonly values: Map<string, BindingValue>;

  public constructor(definition: WebGPUBindingGroupDefinition) {
    this.definition = definition;
    this.version = 0;
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

    if (this.values.get(name) === value) {
      return this;
    }

    WebGPUShaderTypeGuard.assertShaderType(property.type, value);

    this.values.set(name, value);
    this.version++;

    return this;
  }

  public clone(): WebGPUBindingGroup {
    const clone: WebGPUBindingGroup = new WebGPUBindingGroup(this.definition);

    for (const [key, value] of this.values) {
      clone.values.set(key, value);
    }

    clone.version = this.version;

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
