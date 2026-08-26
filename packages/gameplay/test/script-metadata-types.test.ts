import { describe, expect, it } from "vitest";

import { AtlasScript } from "../src/scripting/core/AtlasScript";
import type { GameEntity } from "../src/scripting/core/GameEntity";
import {
  ScriptMetadata,
  getExposedFields,
  registerScriptMetadata,
} from "../src/scripting/core/ScriptMetadata";

type EmitterProps = { walkInterval?: number; runInterval?: number };

abstract class Emitter<TProps extends object = object> extends AtlasScript<
  TProps & EmitterProps
> {
  protected walkInterval: number = 0.2;
  protected runInterval: number = 0.1;
}

registerScriptMetadata(Emitter, {
  exposed: {
    walkInterval: ScriptMetadata.field(),
    runInterval: ScriptMetadata.field(),
  },
});

class Spawner extends Emitter<{ amount: number }> {
  public amount!: number;
}

registerScriptMetadata(Spawner, {
  exposed: { amount: ScriptMetadata.field({ required: true }) },
});

class Follower extends AtlasScript<{ target: GameEntity; speed: number }> {
  public target!: GameEntity;
  public speed!: number;
}

registerScriptMetadata(Follower, {
  exposed: {
    target: ScriptMetadata.entity({ required: true }),
    speed: ScriptMetadata.field({ required: true }),
  },
});

class Unknown extends AtlasScript<{ known: number }> {
  public known!: number;
}

registerScriptMetadata(Unknown, {
  exposed: {
    known: ScriptMetadata.field({ required: true }),
    // @ts-expect-error — "stranger" is not a key of the declared props
    stranger: ScriptMetadata.field(),
  },
});

class WrongKind extends AtlasScript<{ target: GameEntity; speed: number }> {
  public target!: GameEntity;
  public speed!: number;
}

registerScriptMetadata(WrongKind, {
  exposed: {
    // @ts-expect-error — a GameEntity prop must be exposed with entity()
    target: ScriptMetadata.field({ required: true }),
    // @ts-expect-error — a non-entity prop must be exposed with field()
    speed: ScriptMetadata.entity({ required: true }),
  },
});

describe("registerScriptMetadata — prop/metadata typing", () => {
  it("accepts a subclass registering only its own props", () => {
    expect([...getExposedFields(Spawner).keys()].sort()).toEqual([
      "amount",
      "runInterval",
      "walkInterval",
    ]);
  });

  it("accepts entity() on a GameEntity prop and field() on the rest", () => {
    const fields: Map<string, { type: string }> = getExposedFields(Follower);

    expect(fields.get("target")?.type).toBe("entity");
    expect(fields.get("speed")?.type).toBe("field");
  });
});
