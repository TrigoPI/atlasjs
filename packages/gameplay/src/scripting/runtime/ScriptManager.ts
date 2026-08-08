import { ServiceRegistry } from "@atlasjs/core";
import { Entity, NexusWorld, Unsubscribe } from "@atlasjs/nexus";
import { Logger, createLogger } from "@atlasjs/utils";

import { ScriptHost } from "../../components/ScriptHost";

import { RuntimeScriptContext } from "./RuntimeScriptContext";
import { IncrementalScriptIdGenerator } from "./IncrementalScriptIdGenerator";

import {
  AtlasScript,
  ExposeFieldMetadata,
  GameEntity,
  ScriptConstructor,
  ScriptID,
  ScriptInstanceRecord,
  ScriptMetadata,
  ScriptResolver,
  createGameEntity,
  getScriptMetadata,
} from "../core";

type PropsOf<T> = T extends AtlasScript<infer P> ? P : {};

export type AttachProps<P> = {
  [K in keyof P]: P[K] extends GameEntity ? Entity : P[K];
};

export type AttachArgs<T> =
  {} extends AttachProps<PropsOf<T>>
    ? [props?: AttachProps<PropsOf<T>>]
    : [props: AttachProps<PropsOf<T>>];

export class ScriptManager implements ScriptResolver {
  private readonly records: Map<ScriptID, ScriptInstanceRecord>;
  private readonly recordsByEntity: Map<Entity, Set<ScriptID>>;
  private readonly idGenerator: IncrementalScriptIdGenerator;
  private readonly world: NexusWorld;
  private readonly services: ServiceRegistry;
  private readonly logger: Logger;

  private readonly pendingCreate: ScriptID[];
  private readonly pendingDestroy: ScriptID[];

  private readonly unsubscribeHost: Unsubscribe;

  public constructor(
    world: NexusWorld,
    services: ServiceRegistry,
    logger?: Logger,
  ) {
    this.world = world;
    this.services = services;
    this.logger = logger ?? createLogger("ScriptManager");

    this.pendingCreate = [];
    this.pendingDestroy = [];

    this.records = new Map<ScriptID, ScriptInstanceRecord>();
    this.recordsByEntity = new Map<Entity, Set<ScriptID>>();
    this.idGenerator = new IncrementalScriptIdGenerator();

    this.world.defineComponent(ScriptHost);
    this.unsubscribeHost = this.world.onRemove(
      ScriptHost,
      (entity: Entity): void => this.destroyEntityScripts(entity),
    );
  }

  public attach<TScript extends AtlasScript>(
    entityId: Entity,
    ScriptType: ScriptConstructor<TScript>,
    ...rest: AttachArgs<TScript>
  ): TScript {
    const instance: TScript = new ScriptType();
    const context: RuntimeScriptContext = new RuntimeScriptContext(
      entityId,
      this.world,
      this.services,
      this,
    );

    instance.__bindContext(context);
    this.injectProps(instance, ScriptType, rest[0]);

    if (!this.world.hasComponent(entityId, ScriptHost)) {
      this.world.addComponent(entityId, ScriptHost);
    }

    const record: ScriptInstanceRecord<TScript> = {
      scriptType: ScriptType,
      scriptId: this.idGenerator.next(),
      isCreated: false,
      isDestroyed: false,
      isEnabled: true,
      entityId,
      instance,
    };

    this.records.set(record.scriptId, record);

    let entityRecords: Set<ScriptID> | undefined =
      this.recordsByEntity.get(entityId);

    if (!entityRecords) {
      entityRecords = new Set<ScriptID>();
      this.recordsByEntity.set(entityId, entityRecords);
    }

    entityRecords.add(record.scriptId);
    this.pendingCreate.push(record.scriptId);

    return instance;
  }

  public destroyById(scriptId: ScriptID): void {
    const record: ScriptInstanceRecord | undefined = this.records.get(scriptId);

    if (!record || record.isDestroyed) {
      return;
    }

    record.isDestroyed = true;
    this.pendingDestroy.push(scriptId);
  }

  public destroyAllByEntity(entityId: Entity): void {
    const recordIds: Set<ScriptID> | undefined =
      this.recordsByEntity.get(entityId);

    if (!recordIds) {
      return;
    }

    for (const recordId of recordIds) {
      this.destroyById(recordId);
    }
  }

  public update(dt: number): void {
    this.flushCreates();

    for (const record of this.records.values()) {
      if (!record.isCreated || record.isDestroyed || !record.isEnabled) {
        continue;
      }

      record.instance.onUpdate?.(dt);
    }

    this.flushDestroys();
  }

  public fixedUpdate(): void {
    this.flushCreates();

    for (const record of this.records.values()) {
      if (!record.isCreated || record.isDestroyed || !record.isEnabled) {
        continue;
      }

      record.instance.onFixedUpdate?.();
    }

    this.flushDestroys();
  }

  public setEnabled(scriptId: ScriptID, enabled: boolean): void {
    const record: ScriptInstanceRecord | undefined = this.records.get(scriptId);

    if (!record || record.isDestroyed) {
      return;
    }

    record.isEnabled = enabled;
  }

  public getScriptsByEntity(entityId: Entity): readonly AtlasScript[] {
    const recordIds: Set<ScriptID> | undefined =
      this.recordsByEntity.get(entityId);

    if (!recordIds) {
      return [];
    }

    const scripts: AtlasScript[] = [];

    for (const recordId of recordIds) {
      const record: ScriptInstanceRecord | undefined =
        this.records.get(recordId);

      if (!record || record.isDestroyed) {
        continue;
      }

      scripts.push(record.instance);
    }

    return scripts;
  }

  public destroyEntityScripts(entityId: Entity): void {
    this.destroyAllByEntity(entityId);
  }

  public dispose(): void {
    this.unsubscribeHost();
  }

  public getScript<T extends AtlasScript>(
    entityId: Entity,
    type: ScriptConstructor<T>,
  ): T | undefined {
    const recordIds: Set<ScriptID> | undefined =
      this.recordsByEntity.get(entityId);

    if (!recordIds) {
      return undefined;
    }

    for (const recordId of recordIds) {
      const record: ScriptInstanceRecord | undefined =
        this.records.get(recordId);

      if (record && !record.isDestroyed && record.instance instanceof type) {
        return record.instance as T;
      }
    }

    return undefined;
  }

  private injectProps(
    instance: AtlasScript,
    ScriptType: ScriptConstructor,
    props?: object,
  ): void {
    const metadata: ScriptMetadata | undefined = getScriptMetadata(ScriptType);
    const exposed: Record<string, ExposeFieldMetadata> =
      metadata?.exposed ?? {};
    const source: Record<string, unknown> = (props ?? {}) as Record<
      string,
      unknown
    >;
    const target: Record<string, unknown> = instance as unknown as Record<
      string,
      unknown
    >;

    for (const field of Object.keys(exposed)) {
      const meta: ExposeFieldMetadata = exposed[field];

      if (field in source) {
        target[field] =
          meta.type === "entity"
            ? createGameEntity(source[field] as Entity, this.world, this)
            : source[field];
      } else if (meta.required === true) {
        this.logger.warn(
          `"${ScriptType.name}" exposes required field "${field}" but no value was provided.`,
        );
      }
    }

    for (const key of Object.keys(source)) {
      if (!(key in exposed)) {
        this.logger.warn(
          `Prop "${key}" provided to "${ScriptType.name}" is not exposed and was ignored.`,
        );
      }
    }
  }

  private flushCreates(): void {
    while (this.pendingCreate.length > 0) {
      const scriptId: ScriptID = this.pendingCreate.shift()!;
      const record: ScriptInstanceRecord | undefined =
        this.records.get(scriptId);

      if (!record || record.isDestroyed || record.isCreated) {
        continue;
      }

      record.isCreated = true;
      record.instance.onCreate?.();
    }
  }

  private flushDestroys(): void {
    while (this.pendingDestroy.length > 0) {
      const scriptId: ScriptID = this.pendingDestroy.shift()!;
      const record: ScriptInstanceRecord | undefined =
        this.records.get(scriptId);

      if (!record) {
        continue;
      }

      if (record.isCreated) {
        record.instance.onDestroy?.();
      }

      record.instance.__unbindContext();
      this.records.delete(scriptId);

      const entityRecords: Set<ScriptID> | undefined = this.recordsByEntity.get(
        record.entityId,
      );

      if (entityRecords) {
        entityRecords.delete(scriptId);

        if (entityRecords.size === 0) {
          this.recordsByEntity.delete(record.entityId);
        }
      }
    }
  }
}
