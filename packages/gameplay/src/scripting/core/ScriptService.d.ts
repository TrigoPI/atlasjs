import { ServiceRegistry, ServiceToken } from "@atlasjs/core";
export interface ScriptServiceCtor<TFacade, TService> {
    new (services: ServiceRegistry): TFacade;
    readonly token: ServiceToken<TService>;
}
export declare abstract class ScriptService<TService> {
    protected readonly provided: TService;
    constructor(services: ServiceRegistry);
}
//# sourceMappingURL=ScriptService.d.ts.map