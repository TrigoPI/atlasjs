import { ServiceRegistry, ServiceToken } from "@atlasjs/core";

export interface ScriptServiceCtor<TFacade, TService> {
  new (services: ServiceRegistry): TFacade;
  readonly token: ServiceToken<TService>;
}

export abstract class ScriptService<TService> {
  protected readonly services: ServiceRegistry;

  public constructor(services: ServiceRegistry) {
    const ctor: ScriptServiceCtor<this, TService> = this
      .constructor as unknown as ScriptServiceCtor<this, TService>;

    if (ctor.token === undefined) {
      throw new Error(
        `[ScriptService] "${ctor.name}" must declare a static "token" backing service.`,
      );
    }

    this.services = services;
  }

  protected resolve(): TService {
    const ctor: ScriptServiceCtor<this, TService> = this
      .constructor as unknown as ScriptServiceCtor<this, TService>;
    return this.services.get(ctor.token);
  }
}
