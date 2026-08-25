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
    this.ensureHostStoreIsSweptFirst();
    this.unsubscribeHost = this.world.onRemove(
      ScriptHost,
      (entity: Entity): void => this.tearDownEntityScripts(entity),
    );
  }

  private ensureHostStoreIsSweptFirst(): void {
    this.world.getStore(ScriptHost);
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

  public update(dt: number): void {
    this.runLifecycle("onUpdate", (record: ScriptInstanceRecord): void => {
      record.instance.onUpdate?.(dt);
    });
  }

  public fixedUpdate(): void {
    this.runLifecycle("onFixedUpdate", (record: ScriptInstanceRecord): void => {
      record.instance.onFixedUpdate?.();
    });
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
    const recordIds: Set<ScriptID> | undefined =
      this.recordsByEntity.get(entityId);

    if (!recordIds) {
      return;
    }

    for (const recordId of recordIds) {
      this.destroyById(recordId);
    }
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

  private describeFailure(
    record: ScriptInstanceRecord,
    phase: string,
    error: unknown,
  ): string {
    const detail: string =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);

    return `Script "${record.scriptType.name}" on entity ${record.entityId} threw in ${phase}: ${detail}.`;
  }

  private runLifecycle(
    phase: string,
    invoke: (record: ScriptInstanceRecord) => void,
  ): void {
    try {
      this.flushCreates();

      for (const record of this.records.values()) {
        if (!record.isCreated || record.isDestroyed || !record.isEnabled) {
          continue;
        }

        try {
          invoke(record);
        } catch (error: unknown) {
          record.isEnabled = false;
          this.logger.error(
            `${this.describeFailure(record, phase, error)} The script has been disabled.`,
          );
        }
      }
    } finally {
      this.flushDestroys();
    }
  }

  private flushCreates(): void {
    for (let i: number = 0; i < this.pendingCreate.length; i++) {
      const scriptId: ScriptID = this.pendingCreate[i];
      const record: ScriptInstanceRecord | undefined =
        this.records.get(scriptId);

      if (!record || record.isDestroyed || record.isCreated) {
        continue;
      }

      record.isCreated = true;

      try {
        record.instance.onCreate?.();
      } catch (error: unknown) {
        record.isEnabled = false;
        this.logger.error(
          `${this.describeFailure(record, "onCreate", error)} The script has been disabled.`,
        );
      }
    }

    this.pendingCreate.length = 0;
  }

  private flushDestroys(): void {
    for (let i: number = 0; i < this.pendingDestroy.length; i++) {
      this.tearDownScript(this.pendingDestroy[i]);
    }

    this.pendingDestroy.length = 0;
  }

  private tearDownEntityScripts(entityId: Entity): void {
    const recordIds: Set<ScriptID> | undefined =
      this.recordsByEntity.get(entityId);

    if (!recordIds) {
      return;
    }

    const scriptIds: ScriptID[] = [...recordIds];

    for (let i: number = 0; i < scriptIds.length; i++) {
      const record: ScriptInstanceRecord | undefined = this.records.get(
        scriptIds[i],
      );

      if (record) {
        record.isDestroyed = true;
      }
    }

    for (let i: number = 0; i < scriptIds.length; i++) {
      this.tearDownScript(scriptIds[i]);
    }
  }

  private tearDownScript(scriptId: ScriptID): void {
    const record: ScriptInstanceRecord | undefined = this.records.get(scriptId);

    if (!record) {
      return;
    }

    record.isDestroyed = true;
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

    try {
      if (record.isCreated) {
        record.instance.onDestroy?.();
      }
    } catch (error: unknown) {
      this.logger.error(
        `${this.describeFailure(record, "onDestroy", error)} Its cleanup was completed anyway.`,
      );
    } finally {
      record.instance.__unbindContext();
    }
  }
}
