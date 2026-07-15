import {
  ActionFor,
  ActionMapDescriptor,
  AnyActionSpec,
  InputActionMap,
} from "@atlasjs/input";

export class PlayerInput<
  T extends Record<string, AnyActionSpec> = Record<string, AnyActionSpec>,
> {
  public readonly map: InputActionMap<T>;

  public constructor(descriptor: ActionMapDescriptor<T>) {
    this.map = new InputActionMap(descriptor);
  }

  public get<K extends keyof T>(name: K): ActionFor<T[K]["kind"]> {
    return this.map.get(name);
  }

  public get enabled(): boolean {
    return this.map.enabled;
  }

  public set enabled(value: boolean) {
    this.map.enabled = value;
  }
}
