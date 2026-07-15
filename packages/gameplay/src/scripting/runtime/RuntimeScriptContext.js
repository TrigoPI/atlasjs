import { ScriptComponent, } from "../core";
// prettier-ignore
export class RuntimeScriptContext {
    entity;
    world;
    services;
    constructor(entity, world, services) {
        this.entity = entity;
        this.world = world;
        this.services = services;
    }
    getEntityId() {
        return this.entity;
    }
    getService(type) {
        return new type(this.services);
    }
    hasComponent(type) {
        if (this.isFacade(type)) {
            return this.world.hasComponent(this.entity, type.engine);
        }
        return this.world.hasComponent(this.entity, type);
    }
    getComponent(type) {
        if (this.isFacade(type)) {
            if (!this.world.hasComponent(this.entity, type.engine)) {
                return undefined;
            }
            return new type(this.world, this.entity);
        }
        return this.world.getComponent(this.entity, type);
    }
    addComponent(type, ...args) {
        if (this.isFacade(type)) {
            if (!this.world.hasComponent(this.entity, type.engine)) {
                this.world.addComponent(this.entity, type.engine, ...args);
            }
            return new type(this.world, this.entity);
        }
        const existing = this.world.getComponent(this.entity, type);
        if (existing !== undefined) {
            return existing;
        }
        return this.world.addComponent(this.entity, type, ...args);
    }
    removeComponent(type) {
        if (this.isFacade(type)) {
            this.world.removeComponent(this.entity, type.engine);
            return;
        }
        this.world.removeComponent(this.entity, type);
    }
    isFacade(type) {
        return type.prototype instanceof ScriptComponent;
    }
}
//# sourceMappingURL=RuntimeScriptContext.js.map