import type { Entity } from "@atlasjs/nexus";

import type {
  AtlasScript,
  AttachProps,
  GameEntity,
  PropsOf,
  ScriptConstructor,
} from "../scripting/core";

import { injectScriptProps } from "../scripting/core";

import {
  type InstantiateRecord,
  type StubComponentEntries,
  type StubServiceEntries,
  type WrapEntity,
  StubScriptContext,
} from "./StubScriptContext";

import { type RecordingLogger, createRecordingLogger } from "./RecordingLogger";

export interface ScriptHarnessOptions<TScript extends AtlasScript> {
  props?: AttachProps<PropsOf<TScript>>;
  components?: StubComponentEntries;
  services?: StubServiceEntries;
  /**
   * Internal fields with no exposed prop behind them. Props belong in
   * `props`, so they travel the real injection path.
   */
  fields?: Readonly<Record<string, unknown>>;
  entityId?: Entity;
  wrapEntity?: WrapEntity;
}

export interface ScriptHarness<TScript extends AtlasScript> {
  readonly script: TScript;
  readonly context: StubScriptContext;
  readonly instantiations: readonly InstantiateRecord[];
  readonly warnings: readonly string[];
  readonly errors: readonly string[];

  create(): void;
}

export function createScriptHarness<TScript extends AtlasScript>(
  ScriptType: ScriptConstructor<TScript>,
  options: ScriptHarnessOptions<TScript> = {},
): ScriptHarness<TScript> {
  const script: TScript = new ScriptType();
  const recording: RecordingLogger = createRecordingLogger(ScriptType.name);

  const context: StubScriptContext = new StubScriptContext({
    entityId: options.entityId,
    components: options.components,
    services: options.services,
    wrapEntity: options.wrapEntity,
  });

  script.__bindContext(context);

  injectScriptProps(script, ScriptType, options.props, {
    logger: recording.logger,
    wrapEntity: (entity: Entity): GameEntity => context.getEntity(entity),
  });

  if (options.fields !== undefined) {
    Object.assign(script, options.fields);
  }

  return {
    script,
    context,
    instantiations: context.instantiations,
    warnings: recording.transport.warnings,
    errors: recording.transport.errors,
    create: (): void => {
      script.onCreate?.();
    },
  };
}
