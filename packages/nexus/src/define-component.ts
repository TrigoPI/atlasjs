import { ComponentID, Component } from "./nexus-types";
import { defaultComponentRegistry } from "./ComponentRegistry";

export function defineComponent<T extends object>(
  ctor: Component<T>,
): ComponentID {
  return defaultComponentRegistry.register(ctor);
}
