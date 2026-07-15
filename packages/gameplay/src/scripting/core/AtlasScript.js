// prettier-ignore
export class AtlasScript {
    __context;
    __bindContext(context) {
        this.__context = context;
    }
    __unbindContext() {
        this.__context = undefined;
    }
    get context() {
        if (!this.__context) {
            throw new Error("[AtlasScript] Script context is not bound. This script is being used outside of the runtime.");
        }
        return this.__context;
    }
    get entityId() {
        return this.context.getEntityId();
    }
    getService(type) {
        return this.context.getService(type);
    }
    hasComponent(type) {
        return this.context.hasComponent(type);
    }
    getComponent(type) {
        return this.context.getComponent(type);
    }
    addComponent(type, ...args) {
        return this.context.addComponent(type, ...args);
    }
    removeComponent(type) {
        this.context.removeComponent(type);
    }
    requireComponent(type) {
        const component = this.getComponent(type);
        if (component === undefined) {
            throw new Error(`[AtlasScript] Required component "${type.name}" is missing on entity "${this.entityId}".`);
        }
        return component;
    }
}
//# sourceMappingURL=AtlasScript.js.map