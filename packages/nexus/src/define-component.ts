import { ComponentID, Component } from "./nexus-types";

let COMPONENT_TYPE_ID: ComponentID = 0 as ComponentID;

export function defineComponent<T>(ctor: Component<T>): ComponentID {
  if ((<any>ctor).componentID !== undefined) {
    return (<any>ctor).componentID as ComponentID;
  }

  Object.defineProperties(ctor, { componentID: { value: COMPONENT_TYPE_ID } });
  return COMPONENT_TYPE_ID++ as ComponentID;
}
