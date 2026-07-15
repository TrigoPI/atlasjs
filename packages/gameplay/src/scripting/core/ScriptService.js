export class ScriptService {
    provided;
    constructor(services) {
        const ctor = this
            .constructor;
        if (ctor.token === undefined) {
            throw new Error(`[ScriptService] "${ctor.name}" must declare a static "token" backing service.`);
        }
        this.provided = services.get(ctor.token);
    }
}
//# sourceMappingURL=ScriptService.js.map