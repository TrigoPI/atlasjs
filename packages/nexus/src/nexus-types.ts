import { NexusWorld } from "./NexusWorld";

export type Entity = number & { readonly __kind: "Entity" };
export type ComponentID = number & { readonly __kind: "ComponentID" };

export type Component<
  TComponent extends object = object,
  TArgs extends unknown[] = [],
> = new (...args: TArgs) => TComponent;

export type ComponentList<T extends object[], TArgs extends unknown[]> = {
  [K in keyof T]: Component<T[K], TArgs>;
};

export type NexusSystemContext = {
  readonly world: NexusWorld;
  readonly dt: number;
};
