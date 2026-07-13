import { Deferred } from "./Deferred";
import { Engine } from "./Engine";
import { ServiceToken } from "./types";

export type PluginDependencies = {
  provides?: readonly ServiceToken<unknown>[];
  requires?: readonly ServiceToken<unknown>[];
};

export abstract class Plugin {
  public readonly id: string;
  public readonly provides: readonly ServiceToken<unknown>[];
  public readonly requires: readonly ServiceToken<unknown>[];
  public readonly deferred: Deferred;

  protected constructor(id: string, deps: PluginDependencies = {}) {
    this.id = id;
    this.provides = deps.provides ?? [];
    this.requires = deps.requires ?? [];
    this.deferred = new Deferred();
  }

  public abstract install(engine: Engine): void | Promise<void>;
  public abstract uninstall(engine: Engine): void;
}
