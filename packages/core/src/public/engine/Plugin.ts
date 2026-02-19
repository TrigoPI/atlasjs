import { Engine } from "./Engine";

export abstract class Plugin {
  readonly id: string;
  readonly order?: number;

  protected constructor(id: string, order?: number) {
    this.id = id;
    this.order = order;
  }

  public abstract install(engine: Engine): void;
  public uninstall(engine: Engine): void {}
}
