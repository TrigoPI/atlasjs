import { createLogger } from "@atlasjs/utils";
import { Plugin } from "@atlasjs/core";
import { NEBULA_RENDERER } from "@atlasjs/nebula";
import { INERTIAL_ENGINE } from "@atlasjs/inertia";
import { NEXUS } from "@atlasjs/nexus";
import { SCRIPT_MANAGER } from "./tokens";
import { registerSystem } from "./registerSystem";
import { ScriptManager } from "./scripting";
import { PhysicsPullSystem, PhysicsPushSystem, SpriteRenderSystem, } from "./systems";
import { PhysicsBodyRef, RigidBody2D, SpriteRender, Transform2D, } from "./components";
export class GameplayPlugin extends Plugin {
    logger;
    scriptManager;
    handles;
    unsubscribers;
    constructor() {
        super("gameplay-plugin", {
            requires: [NEXUS, NEBULA_RENDERER, INERTIAL_ENGINE],
            provides: [SCRIPT_MANAGER],
        });
        this.logger = createLogger(GameplayPlugin.name);
        this.handles = [];
        this.unsubscribers = [];
    }
    //prettier-ignore
    async install(engine) {
        const world = await engine.services.wait(NEXUS);
        const nebula = await engine.services.wait(NEBULA_RENDERER);
        const inertia = await engine.services.wait(INERTIAL_ENGINE);
        this.scriptManager = new ScriptManager(world, engine.services);
        const physicsPushSystem = new PhysicsPushSystem(inertia);
        const physicsPullSystem = new PhysicsPullSystem();
        const spriteRenderSystem = new SpriteRenderSystem(nebula);
        world
            .defineComponent(RigidBody2D)
            .defineComponent(Transform2D)
            .defineComponent(SpriteRender)
            .defineComponent(PhysicsBodyRef);
        this.unsubscribers.push(world.onRemove(PhysicsBodyRef, (_entity, ref) => {
            inertia.destroyRigidBody(ref.body);
        }), world.onRemove(RigidBody2D, (entity) => {
            if (world.hasComponent(entity, PhysicsBodyRef)) {
                world.removeComponent(entity, PhysicsBodyRef);
            }
        }));
        const { fixed, update, render } = engine.scheduler;
        this.handles.push(fixed.add(() => this.scriptManager.fixedUpdate(), {
            name: "gameplay:script-fixed",
            stage: "ScriptFixed",
        }));
        this.handles.push(registerSystem(fixed, world, physicsPushSystem, {
            name: "gameplay:physics-push",
            stage: "PhysicsRequest",
        }), registerSystem(fixed, world, physicsPullSystem, {
            name: "gameplay:physics-pull",
            stage: "PhysicsWriteback",
        }));
        this.handles.push(update.add((ctx) => this.scriptManager.update(ctx.dt), {
            name: "gameplay:script-update",
            stage: "Logic",
        }));
        this.handles.push(registerSystem(render, world, spriteRenderSystem, {
            name: "gameplay:sprite-render",
            stage: "PreRender",
        }));
        this.logger.log("GameplayPlugin installed.");
        engine.services.provide(SCRIPT_MANAGER, this.scriptManager);
        this.deferred.resolve();
    }
    uninstall() {
        this.logger.log("Uninstalling GameplayPlugin.");
        for (const handle of this.handles)
            handle.remove();
        for (const off of this.unsubscribers)
            off();
        this.handles = [];
        this.unsubscribers = [];
    }
}
//# sourceMappingURL=GameplayPlugin.js.map