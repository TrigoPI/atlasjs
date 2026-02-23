import { Deferred } from "./Deferred";
import { Engine } from "./Engine";

export abstract class Plugin {
  public order?: number;
  public readonly id: string;
  public readonly deferred: Deferred;

  protected constructor(id: string, order?: number) {
    this.id = id;
    this.order = order;
    this.deferred = new Deferred();
  }

  public abstract install(engine: Engine): void | Promise<void>;
  public abstract uninstall(engine: Engine): void;

  public setOrder(order: number): void {
    this.order = order;
  }
}
