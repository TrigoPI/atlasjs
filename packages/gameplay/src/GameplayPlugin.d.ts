import { Engine, Plugin } from "@atlasjs/core";
export declare class GameplayPlugin extends Plugin {
    private readonly logger;
    private scriptManager;
    private handles;
    private unsubscribers;
    constructor();
    install(engine: Engine): Promise<void>;
    uninstall(): void;
}
//# sourceMappingURL=GameplayPlugin.d.ts.map