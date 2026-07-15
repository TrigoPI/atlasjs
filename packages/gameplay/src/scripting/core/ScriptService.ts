import { ServiceRegistry, ServiceToken } from "@atlasjs/core";

export interface ScriptServiceCtor<TFacade, TService> {
  new (services: ServiceRegistry): TFacade;
  readonly token: ServiceToken<TService>;
}

export abstract class ScriptService<TService> {
  protected readonly provided: TService;

  public constructor(services: ServiceRegistry) {
    const ctor: ScriptServiceCtor<this, TService> = this
      .constructor as unknown as ScriptServiceCtor<this, TService>;

    if (ctor.token === undefined) {
      throw new Error(
        `[ScriptService] "${ctor.name}" must declare a static "token" backing service.`,
      );
    }

    this.provided = services.get(ctor.token);
  }
}
