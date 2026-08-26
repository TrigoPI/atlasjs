import type { Entity } from "@atlasjs/nexus";
import type { Logger } from "@atlasjs/utils";

import type { AtlasScript } from "./AtlasScript";
import type { GameEntity } from "./GameEntity";
import type { ScriptConstructor } from "./core-types";

import {
  type ExposeFieldMetadata,
  type ScriptMetadata,
  getScriptMetadata,
} from "./ScriptMetadata";

export interface ScriptPropsInjection {
  readonly logger: Logger;

  wrapEntity(entity: Entity): GameEntity;
}

export function injectScriptProps(
  instance: AtlasScript,
  ScriptType: ScriptConstructor,
  props: object | undefined,
  injection: ScriptPropsInjection,
): void {
  const metadata: ScriptMetadata | undefined = getScriptMetadata(ScriptType);
  const exposed: Record<string, ExposeFieldMetadata> = metadata?.exposed ?? {};
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

    const provided: unknown = source[field];

    if (provided !== undefined) {
      target[field] =
        meta.type === "entity"
          ? injection.wrapEntity(provided as Entity)
          : provided;
    } else if (meta.required === true && target[field] === undefined) {
      injection.logger.warn(
        `"${ScriptType.name}" exposes required field "${field}" but no value was provided.`,
      );
    }
  }

  for (const key of Object.keys(source)) {
    if (!(key in exposed)) {
      injection.logger.warn(
        `Prop "${key}" provided to "${ScriptType.name}" is not exposed and was ignored.`,
      );
    }
  }
}
