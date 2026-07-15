import { RuntimeScriptContext } from "./RuntimeScriptContext";
import { IncrementalScriptIdGenerator } from "./IncrementalScriptIdGenerator";
export class ScriptManager {
    records;
    recordsByEntity;
    idGenerator;
    world;
    services;
    pendingCreate;
    pendingDestroy;
    constructor(world, services) {
        this.world = world;
        this.services = services;
        this.pendingCreate = [];
        this.pendingDestroy = [];
        this.records = new Map();
        this.recordsByEntity = new Map();
        this.idGenerator = new IncrementalScriptIdGenerator();
    }
    attach(entityId, ScriptType) {
        const instance = new ScriptType();
        const context = new RuntimeScriptContext(entityId, this.world, this.services);
        instance.__bindContext(context);
        const record = {
            scriptType: ScriptType,
            scriptId: this.idGenerator.next(),
            isCreated: false,
            isDestroyed: false,
            isEnabled: true,
            entityId,
            instance,
        };
        this.records.set(record.scriptId, record);
        let entityRecords = this.recordsByEntity.get(entityId);
        if (!entityRecords) {
            entityRecords = new Set();
            this.recordsByEntity.set(entityId, entityRecords);
        }
        entityRecords.add(record.scriptId);
        this.pendingCreate.push(record.scriptId);
        return instance;
    }
    destroyById(scriptId) {
        const record = this.records.get(scriptId);
        if (!record || record.isDestroyed) {
            return;
        }
        record.isDestroyed = true;
        this.pendingDestroy.push(scriptId);
    }
    destroyAllByEntity(entityId) {
        const recordIds = this.recordsByEntity.get(entityId);
        if (!recordIds) {
            return;
        }
        for (const recordId of recordIds) {
            this.destroyById(recordId);
        }
    }
    update(dt) {
        this.flushCreates();
        for (const record of this.records.values()) {
            if (!record.isCreated || record.isDestroyed || !record.isEnabled) {
                continue;
            }
            record.instance.onUpdate?.(dt);
        }
        this.flushDestroys();
    }
    fixedUpdate() {
        this.flushCreates();
        for (const record of this.records.values()) {
            if (!record.isCreated || record.isDestroyed || !record.isEnabled) {
                continue;
            }
            record.instance.onFixedUpdate?.();
        }
        this.flushDestroys();
    }
    setEnabled(scriptId, enabled) {
        const record = this.records.get(scriptId);
        if (!record || record.isDestroyed) {
            return;
        }
        record.isEnabled = enabled;
    }
    getScriptsByEntity(entityId) {
        const recordIds = this.recordsByEntity.get(entityId);
        if (!recordIds) {
            return [];
        }
        const scripts = [];
        for (const recordId of recordIds) {
            const record = this.records.get(recordId);
            if (!record || record.isDestroyed) {
                continue;
            }
            scripts.push(record.instance);
        }
        return scripts;
    }
    flushCreates() {
        while (this.pendingCreate.length > 0) {
            const scriptId = this.pendingCreate.shift();
            const record = this.records.get(scriptId);
            if (!record || record.isDestroyed || record.isCreated) {
                continue;
            }
            record.isCreated = true;
            record.instance.onCreate?.();
        }
    }
    flushDestroys() {
        while (this.pendingDestroy.length > 0) {
            const scriptId = this.pendingDestroy.shift();
            const record = this.records.get(scriptId);
            if (!record) {
                continue;
            }
            if (record.isCreated) {
                record.instance.onDestroy?.();
            }
            record.instance.__unbindContext();
            this.records.delete(scriptId);
            const entityRecords = this.recordsByEntity.get(record.entityId);
            if (entityRecords) {
                entityRecords.delete(scriptId);
                if (entityRecords.size === 0) {
                    this.recordsByEntity.delete(record.entityId);
                }
            }
        }
    }
}
//# sourceMappingURL=ScriptManager.js.map