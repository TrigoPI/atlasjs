export class ScriptComponent {
    world;
    entity;
    constructor(world, entity) {
        const ctor = this
            .constructor;
        if (ctor.engine === undefined) {
            throw new Error(`[ScriptComponent] "${ctor.name}" must declare a static "engine" backing component.`);
        }
        this.world = world;
        this.entity = entity;
    }
    resolve() {
        const ctor = this
            .constructor;
        return this.world.requireComponent(this.entity, ctor.engine);
    }
}
//# sourceMappingURL=ScriptComponent.js.map