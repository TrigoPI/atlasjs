import { BindingGroupDefinition, BindingGroupProperty } from "../../core";

export class WebGPUBindingGroupDefinition implements BindingGroupDefinition {
  public readonly __kind = "webgpu";
  public readonly id: string;
  public readonly group: number;

  private readonly properties: BindingGroupProperty[];
  private readonly propertyMap: Map<string, BindingGroupProperty>;

  public constructor(id: string, group: number) {
    this.id = id;
    this.group = group;
    this.properties = [];
    this.propertyMap = new Map();
  }

  public getProperties(): ReadonlyArray<BindingGroupProperty> {
    return [...this.properties];
  }

  public has(name: string): boolean {
    return this.propertyMap.has(name);
  }

  public get(name: string): BindingGroupProperty | undefined {
    return this.propertyMap.get(name);
  }

  public add(property: BindingGroupProperty): this {
    if (this.propertyMap.has(property.name)) {
      throw new Error(`Binding property "${property.name}" already exists.`);
    }

    this.properties.push(property);
    this.propertyMap.set(property.name, property);
    return this;
  }

  public destroy(): void {}
}
