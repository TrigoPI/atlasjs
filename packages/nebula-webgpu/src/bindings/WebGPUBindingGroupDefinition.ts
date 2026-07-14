import { WebGPUReflectedGroup, WebGPUReflectedStorage } from "../reflect";
import {
  BindingGroupDefinition,
  BindingGroupProperty,
  ResourcePropertyLayout,
  UniformPropertyLayout,
} from "@atlasjs/nebula";

export class WebGPUBindingGroupDefinition implements BindingGroupDefinition {
  public readonly __kind = "webgpu";
  public readonly id: string;
  public readonly group: number;

  public readonly uniformBinding: number;
  public readonly uniformSize: number;
  public readonly uniformProperties: ReadonlyArray<UniformPropertyLayout>;
  public readonly resourceProperties: ReadonlyArray<ResourcePropertyLayout>;
  public readonly storage?: WebGPUReflectedStorage;

  private readonly properties: ReadonlyArray<BindingGroupProperty>;
  private readonly propertyMap: Map<string, BindingGroupProperty>;

  public constructor(id: string, reflected: WebGPUReflectedGroup) {
    this.id = id;
    this.group = reflected.group;
    this.uniformBinding = reflected.uniformBinding;
    this.uniformSize = reflected.uniformSize;
    this.uniformProperties = reflected.uniformProperties;
    this.resourceProperties = reflected.resourceProperties;
    this.storage = reflected.storage;
    this.properties = reflected.properties;
    this.propertyMap = new Map(
      reflected.properties.map((property: BindingGroupProperty) => [
        property.name,
        property,
      ]),
    );
  }

  public getProperties(): ReadonlyArray<BindingGroupProperty> {
    return this.properties;
  }

  public has(name: string): boolean {
    return this.propertyMap.has(name);
  }

  public get(name: string): BindingGroupProperty | undefined {
    return this.propertyMap.get(name);
  }

  public destroy(): void {}
}
