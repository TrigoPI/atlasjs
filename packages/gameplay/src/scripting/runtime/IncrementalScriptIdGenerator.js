export class IncrementalScriptIdGenerator {
    current;
    constructor() {
        this.current = 0;
    }
    next() {
        this.current += 1;
        return this.current;
    }
}
//# sourceMappingURL=IncrementalScriptIdGenerator.js.map