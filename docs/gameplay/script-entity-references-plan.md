# Références d'entités dans les scripts (`GameEntity`) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de passer une autre entité en paramètre d'un script et d'opérer dessus (`otherEntity.getComponent(Transform)`, `otherEntity.getScript(SwordScript)`), façon référence `GameObject` d'Unity.

**Architecture:** Un handle stateless `GameEntity` wrappe `(world, entity, resolver)` et porte l'unique implémentation du dispatch token/composant + la résolution de script. `RuntimeScriptContext` délègue son propre accès composant à un `GameEntity` de sa propre entité. La métadonnée de script passe à une union discriminée (`{ type: "field" | "entity" }`) authorée via `ScriptMetadata.field()` / `.entity()` ; `injectProps` wrappe une `Entity` brute en `GameEntity` pour les champs `entity`, et un type mappé `AttachProps` accepte une `Entity` au call site là où le script voit un `GameEntity`.

**Tech Stack:** TypeScript, monorepo pnpm/Turborepo, `@atlasjs/nexus` (ECS), vitest (via `test/helpers/harness.ts`), tsdown (build), Vite (sandbox).

**Spec source:** [`script-entity-references.md`](script-entity-references.md).

## Global Constraints

- **Typer tout le code**, même trivial (params de fonction, variables, params de classe). Copié de CLAUDE.md racine.
- **Aucun commentaire** ajouté dans le code.
- **Typecheck via `tsc --noEmit`**, jamais `tsc -b` sur le package (émet des artefacts à côté des sources). Commande package : `pnpm --filter @atlasjs/gameplay typecheck`.
- **Tests** : `pnpm --filter @atlasjs/gameplay test` (vitest run). Cibler un fichier : `pnpm --filter @atlasjs/gameplay exec vitest run <fichier>`.
- **Rebuild du `dist`** requis quand l'API publique du package change, avant que la sandbox (Vite) la résolve : `pnpm --filter @atlasjs/gameplay build`.
- **Respecter les 2 niveaux de composants** (CLAUDE.md package) : ne pas mélanger composants ECS et scripts dans `getComponent`.
- **Pas de commit automatique** (convention superpowers du repo + cadence utilisateur) : chaque tâche se termine en **staged**, l'utilisateur relit et committe lui-même. Les messages de commit sont **suggérés**, pas exécutés.

---

## File Structure

**Nouveau fichier :**
- `packages/gameplay/src/scripting/core/GameEntity.ts` — interface `GameEntity`, interface `ScriptResolver`, factory `createGameEntity` (classe interne `GameEntityHandle` portant l'unique dispatch token/composant + `getScript`).

**Modifiés (package `@atlasjs/gameplay`) :**
- `scripting/core/ScriptMetadata.ts` — union `ExposeFieldMetadata` + `const ScriptMetadata` (builders).
- `scripting/core/ScriptContext.ts` — `+ getEntity(entity): GameEntity`.
- `scripting/core/AtlasScript.ts` — passthrough `getEntity`.
- `scripting/core/index.ts` — exporte `GameEntity`, `createGameEntity`, `ScriptResolver`.
- `scripting/runtime/ScriptManager.ts` — `implements ScriptResolver`, `getScript`, `injectProps` (dispatch `type`), `AttachProps`/`PropsOfArgs`, passe `this` au contexte.
- `scripting/runtime/RuntimeScriptContext.ts` — 4ᵉ param `ScriptResolver`, délègue à `self: GameEntity`, `getEntity`.

**Modifiés (app `sandbox`) :**
- `apps/sandbox/src/game/scripts/{TestScript,SwordScript,WallScript}.ts` — metadata via builders ; `TestScript` reçoit `sword: GameEntity`.
- `apps/sandbox/src/game/EcsScene.ts` — passe `sword` à `TestScript`.

**Tests créés :**
- `packages/gameplay/test/get-script.test.ts` (Task 2)
- `packages/gameplay/test/game-entity.test.ts` (Task 3)
- `packages/gameplay/test/script-get-entity.test.ts` (Task 4)
- `packages/gameplay/test/entity-prop-injection.test.ts` (Task 5)

**Tests migrés (literals metadata → builders) :**
- `packages/gameplay/test/{script-metadata,script-metadata-validation,exposed-injection}.test.ts` (Task 1)

---

## Task 1: Métadonnée en union discriminée + builders `ScriptMetadata.field()/.entity()`

**Files:**
- Modify: `packages/gameplay/src/scripting/core/ScriptMetadata.ts:1-7`
- Modify (migration literals): `packages/gameplay/test/script-metadata.test.ts:11-27,77`, `packages/gameplay/test/script-metadata-validation.test.ts:6-21`, `packages/gameplay/test/exposed-injection.test.ts:5,18-20`

**Interfaces:**
- Produces:
  - `type ExposeFieldMetadata = { type: "field"; required?: boolean } | { type: "entity"; required?: boolean }`
  - `const ScriptMetadata` avec `field(options?: { required?: boolean }): ExposeFieldMetadata` et `entity(options?: { required?: boolean }): ExposeFieldMetadata`
  - `interface ScriptMetadata { exposed: Record<string, ExposeFieldMetadata> }` (inchangée, merge de déclaration avec le `const`)

- [ ] **Step 1: Écrire le test des builders (échoue)**

Ajouter à la fin de `packages/gameplay/test/script-metadata.test.ts` (et importer `ScriptMetadata` comme **valeur** dans l'import existant en tête de fichier) :

```ts
describe("ScriptMetadata builders", () => {
  it("field() tags an entry as a field", () => {
    expect(ScriptMetadata.field({ required: true })).toEqual({
      type: "field",
      required: true,
    });
    expect(ScriptMetadata.field()).toEqual({ type: "field", required: undefined });
  });

  it("entity() tags an entry as an entity ref", () => {
    expect(ScriptMetadata.entity({ required: true })).toEqual({
      type: "entity",
      required: true,
    });
    expect(ScriptMetadata.entity()).toEqual({ type: "entity", required: undefined });
  });
});
```

Mettre à jour l'import en tête de `script-metadata.test.ts` :

```ts
import {
  ExposeFieldMetadata,
  ScriptMetadata,
  getExposedFields,
  getScriptMetadata,
  registerScriptMetadata,
} from "../src/scripting/core/ScriptMetadata";
```

- [ ] **Step 2: Lancer le test → échoue**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/script-metadata.test.ts`
Expected: FAIL — `ScriptMetadata.field is not a function`.

- [ ] **Step 3: Implémenter l'union + les builders**

Remplacer les lignes 1-7 de `packages/gameplay/src/scripting/core/ScriptMetadata.ts` :

```ts
export type ExposeFieldMetadata =
  | { type: "field"; required?: boolean }
  | { type: "entity"; required?: boolean };

export interface ScriptMetadata {
  exposed: Record<string, ExposeFieldMetadata>;
}

export const ScriptMetadata = {
  field(options: { required?: boolean } = {}): ExposeFieldMetadata {
    return { type: "field", required: options.required };
  },
  entity(options: { required?: boolean } = {}): ExposeFieldMetadata {
    return { type: "entity", required: options.required };
  },
};
```

Le reste du fichier (`REGISTRY`, `registerScriptMetadata`, `getScriptMetadata`, `getExposedFields`) est **inchangé** : ces fonctions copient les entrées telles quelles et lisent `.required`, présent sur les deux membres de l'union.

- [ ] **Step 4: Lancer le test → passe**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/script-metadata.test.ts`
Expected: PASS (builders + tests de merge existants).

- [ ] **Step 5: Migrer les literals metadata des tests vers les builders**

Dans `packages/gameplay/test/script-metadata.test.ts`, remplacer les enregistrements (lignes ~11-27 et ~77) :

```ts
class Simple {}
registerScriptMetadata(Simple, {
  exposed: { a: ScriptMetadata.field({ required: true }), b: ScriptMetadata.field() },
});

class Base {}
registerScriptMetadata(Base, { exposed: { base: ScriptMetadata.field() } });

class Child extends Base {}
registerScriptMetadata(Child, {
  exposed: { a: ScriptMetadata.field(), b: ScriptMetadata.field() },
});

class GrandChild extends Child {}
registerScriptMetadata(GrandChild, { exposed: { c: ScriptMetadata.field() } });
```

Et le `Rebound` (~ligne 77) :

```ts
registerScriptMetadata(Rebound, { exposed: { a: ScriptMetadata.field({ required: true }) } });
```

Dans `packages/gameplay/test/script-metadata-validation.test.ts`, ajouter `ScriptMetadata` à l'import depuis `../src/scripting` et migrer :

```ts
registerScriptMetadata(Required, {
  exposed: { needed: ScriptMetadata.field({ required: true }) },
});
registerScriptMetadata(SingleField, {
  exposed: { a: ScriptMetadata.field({ required: true }) },
});
```

Dans `packages/gameplay/test/exposed-injection.test.ts`, ajouter `ScriptMetadata` à l'import depuis `../src/scripting` et migrer :

```ts
registerScriptMetadata(Injected, {
  exposed: {
    label: ScriptMetadata.field({ required: true }),
    count: ScriptMetadata.field({ required: true }),
  },
});
```

- [ ] **Step 6: Migrer les literals metadata de la sandbox vers les builders**

Dans `apps/sandbox/src/game/scripts/WallScript.ts`, `SwordScript.ts`, `TestScript.ts` : ajouter `ScriptMetadata` à l'import `@atlasjs/gameplay` et remplacer chaque `xxx: { required: true }` par `xxx: ScriptMetadata.field({ required: true })`.

Exemple `WallScript.ts` :

```ts
registerScriptMetadata(WallScript, {
  exposed: {
    sprite: ScriptMetadata.field({ required: true }),
  },
});
```

(Idem pour les 7 champs de `SwordScript` et les 4 champs de `TestScript`.)

- [ ] **Step 7: Rebuild dist + vérifier package & sandbox**

Run:
```bash
pnpm --filter @atlasjs/gameplay test
pnpm --filter @atlasjs/gameplay typecheck
pnpm --filter @atlasjs/gameplay build
pnpm --filter sandbox exec tsc --noEmit
```
Expected: tous verts. (Le `build` régénère `dist` pour que la sandbox résolve la valeur `ScriptMetadata`.)

- [ ] **Step 8: Stage & hand off**

```bash
git add packages/gameplay/src/scripting/core/ScriptMetadata.ts \
        packages/gameplay/test/script-metadata.test.ts \
        packages/gameplay/test/script-metadata-validation.test.ts \
        packages/gameplay/test/exposed-injection.test.ts \
        apps/sandbox/src/game/scripts/WallScript.ts \
        apps/sandbox/src/game/scripts/SwordScript.ts \
        apps/sandbox/src/game/scripts/TestScript.ts
```
Ne pas committer — l'utilisateur relit et committe. Message suggéré : `feat(scripting): discriminated ExposeFieldMetadata union + ScriptMetadata.field/entity builders`.

---

## Task 2: `ScriptManager.getScript(entity, type)`

**Files:**
- Modify: `packages/gameplay/src/scripting/runtime/ScriptManager.ts` (ajout d'une méthode publique après `getScriptsByEntity`, ~ligne 175)
- Test: `packages/gameplay/test/get-script.test.ts` (créer)

**Interfaces:**
- Consumes: `AtlasScript`, `ScriptConstructor`, `ScriptID`, `ScriptInstanceRecord` (déjà importés dans `ScriptManager.ts`).
- Produces: `ScriptManager.getScript<T extends AtlasScript>(entity: Entity, type: ScriptConstructor<T>): T | undefined` — renvoie la première instance `instanceof type` attachée à `entity` (records `isDestroyed` ignorés), sinon `undefined`.

- [ ] **Step 1: Écrire le test (échoue)**

Créer `packages/gameplay/test/get-script.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { AtlasScript } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class Alpha extends AtlasScript {
  public tag: string = "alpha";
}
class Beta extends AtlasScript {
  public tag: string = "beta";
}
class SubAlpha extends Alpha {}

describe("ScriptManager.getScript", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("returns the instance of the requested type on an entity", () => {
    const e: Entity = h.world.createEntity();
    const a: Alpha = h.scripts.attach(e, Alpha);
    h.scripts.attach(e, Beta);

    expect(h.scripts.getScript(e, Alpha)).toBe(a);
  });

  it("matches subclasses via instanceof", () => {
    const e: Entity = h.world.createEntity();
    const s: SubAlpha = h.scripts.attach(e, SubAlpha);

    expect(h.scripts.getScript(e, Alpha)).toBe(s);
  });

  it("returns undefined when no script of that type is attached", () => {
    const e: Entity = h.world.createEntity();
    h.scripts.attach(e, Beta);

    expect(h.scripts.getScript(e, Alpha)).toBeUndefined();
  });

  it("returns undefined for an entity with no scripts", () => {
    const e: Entity = h.world.createEntity();

    expect(h.scripts.getScript(e, Alpha)).toBeUndefined();
  });

  it("stops returning a destroyed script", () => {
    const e: Entity = h.world.createEntity();
    h.scripts.attach(e, Alpha);
    h.scripts.destroyAllByEntity(e);

    expect(h.scripts.getScript(e, Alpha)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Lancer le test → échoue**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/get-script.test.ts`
Expected: FAIL — `h.scripts.getScript is not a function`.

- [ ] **Step 3: Implémenter `getScript`**

Dans `packages/gameplay/src/scripting/runtime/ScriptManager.ts`, ajouter après la méthode `getScriptsByEntity` (~ligne 175) :

```ts
public getScript<T extends AtlasScript>(
  entity: Entity,
  type: ScriptConstructor<T>,
): T | undefined {
  const recordIds: Set<ScriptID> | undefined = this.recordsByEntity.get(entity);

  if (!recordIds) {
    return undefined;
  }

  for (const recordId of recordIds) {
    const record: ScriptInstanceRecord | undefined = this.records.get(recordId);

    if (record && !record.isDestroyed && record.instance instanceof type) {
      return record.instance as T;
    }
  }

  return undefined;
}
```

- [ ] **Step 4: Lancer le test → passe**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/get-script.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck & hand off**

Run: `pnpm --filter @atlasjs/gameplay typecheck`
Expected: vert.

```bash
git add packages/gameplay/src/scripting/runtime/ScriptManager.ts \
        packages/gameplay/test/get-script.test.ts
```
Message suggéré : `feat(scripting): ScriptManager.getScript(entity, type)`.

---

## Task 3: Handle `GameEntity` + `ScriptResolver` + `createGameEntity`

**Files:**
- Create: `packages/gameplay/src/scripting/core/GameEntity.ts`
- Modify: `packages/gameplay/src/scripting/core/index.ts:1-7` (ajouter l'export)
- Modify: `packages/gameplay/src/scripting/runtime/ScriptManager.ts` (déclaration de classe `implements ScriptResolver` + import)
- Test: `packages/gameplay/test/game-entity.test.ts` (créer)

**Interfaces:**
- Consumes: `Component`, `Entity`, `NexusWorld` (nexus) ; `AtlasScript`, `ScriptConstructor` (core) ; `ScriptComponentToken`, `isScriptComponentToken` (core) ; `ScriptManager.getScript` (Task 2).
- Produces:
  - `interface GameEntity` — `id: Entity` ; `hasComponent` ; `getComponent` (overloads token/composant) ; `addComponent` (overloads) ; `removeComponent` ; `requireComponent` (overloads) ; `getScript<T extends AtlasScript>(type: ScriptConstructor<T>): T | undefined`.
  - `interface ScriptResolver` — `getScript<T extends AtlasScript>(entity: Entity, type: ScriptConstructor<T>): T | undefined`.
  - `function createGameEntity(entity: Entity, world: NexusWorld, scripts: ScriptResolver): GameEntity`.

- [ ] **Step 1: Écrire le test (échoue)**

Créer `packages/gameplay/test/game-entity.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { Transform2D } from "../src/components";
import {
  AtlasScript,
  GameEntity,
  Transform,
  createGameEntity,
} from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class Marker extends AtlasScript {
  public label: string = "marker";
}

describe("GameEntity handle", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("exposes the target entity id", () => {
    const e: Entity = h.world.createEntity();
    const ge: GameEntity = createGameEntity(e, h.world, h.scripts);

    expect(ge.id).toBe(e);
  });

  it("addComponent(token) adds the backing engine component on the target", () => {
    const e: Entity = h.world.createEntity();
    const ge: GameEntity = createGameEntity(e, h.world, h.scripts);

    const t: Transform = ge.addComponent(Transform);
    t.setPosition(5, 6);

    expect(h.world.hasComponent(e, Transform2D)).toBe(true);
    expect(h.world.requireComponent(e, Transform2D).position.x).toBe(5);
  });

  it("hasComponent / getComponent reflect the target entity", () => {
    const e: Entity = h.world.createEntity();
    const ge: GameEntity = createGameEntity(e, h.world, h.scripts);

    expect(ge.hasComponent(Transform)).toBe(false);
    expect(ge.getComponent(Transform)).toBeUndefined();

    ge.addComponent(Transform);

    expect(ge.hasComponent(Transform)).toBe(true);
    expect(ge.getComponent(Transform)).toBeDefined();
  });

  it("requireComponent throws when the component is missing", () => {
    const e: Entity = h.world.createEntity();
    const ge: GameEntity = createGameEntity(e, h.world, h.scripts);

    expect(() => ge.requireComponent(Transform)).toThrow();
  });

  it("removeComponent removes the backing engine component", () => {
    const e: Entity = h.world.createEntity();
    const ge: GameEntity = createGameEntity(e, h.world, h.scripts);

    ge.addComponent(Transform);
    ge.removeComponent(Transform);

    expect(h.world.hasComponent(e, Transform2D)).toBe(false);
  });

  it("getScript resolves a script attached to the target entity", () => {
    const e: Entity = h.world.createEntity();
    const m: Marker = h.scripts.attach(e, Marker);
    const ge: GameEntity = createGameEntity(e, h.world, h.scripts);

    expect(ge.getScript(Marker)).toBe(m);
  });
});
```

- [ ] **Step 2: Lancer le test → échoue**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/game-entity.test.ts`
Expected: FAIL — `createGameEntity` / `GameEntity` introuvable dans `../src/scripting`.

- [ ] **Step 3: Créer `GameEntity.ts`**

Créer `packages/gameplay/src/scripting/core/GameEntity.ts` :

```ts
import { Component, Entity, NexusWorld } from "@atlasjs/nexus";

import { AtlasScript } from "./AtlasScript";
import { ScriptConstructor } from "./core-types";
import {
  ScriptComponentToken,
  isScriptComponentToken,
} from "./ScriptComponentToken";

// prettier-ignore
export interface GameEntity {
  readonly id: Entity;

  hasComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): boolean;

  getComponent<TApi, TEngine extends object>(type: ScriptComponentToken<TApi, TEngine, any[]>): TApi | undefined;
  getComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent | undefined;

  addComponent<TApi, TEngine extends object, TArgs extends unknown[]>(type: ScriptComponentToken<TApi, TEngine, TArgs>, ...args: TArgs): TApi;
  addComponent<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs>, ...args: TArgs): TComponent;

  removeComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): void;

  requireComponent<TApi, TEngine extends object>(type: ScriptComponentToken<TApi, TEngine, any[]>): TApi;
  requireComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent;

  getScript<T extends AtlasScript>(type: ScriptConstructor<T>): T | undefined;
}

// prettier-ignore
export interface ScriptResolver {
  getScript<T extends AtlasScript>(entity: Entity, type: ScriptConstructor<T>): T | undefined;
}

// prettier-ignore
class GameEntityHandle implements GameEntity {
  private readonly world: NexusWorld;
  private readonly entity: Entity;
  private readonly scripts: ScriptResolver;

  public constructor(entity: Entity, world: NexusWorld, scripts: ScriptResolver) {
    this.entity = entity;
    this.world = world;
    this.scripts = scripts;
  }

  public get id(): Entity {
    return this.entity;
  }

  public hasComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): boolean {
    return this.world.hasComponent(this.entity, isScriptComponentToken(type) ? type.engine : type);
  }

  public getComponent<TApi, TEngine extends object>(type: ScriptComponentToken<TApi, TEngine, any[]>): TApi | undefined;
  public getComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent | undefined;
  public getComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): unknown {
    if (isScriptComponentToken(type)) {
      return this.world.hasComponent(this.entity, type.engine) ? type.create(this.world, this.entity) : undefined;
    }
    return this.world.getComponent(this.entity, type);
  }

  public addComponent<TApi, TEngine extends object, TArgs extends unknown[]>(type: ScriptComponentToken<TApi, TEngine, TArgs>, ...args: TArgs): TApi;
  public addComponent<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs>, ...args: TArgs): TComponent;
  public addComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>, ...args: any[]): unknown {
    if (isScriptComponentToken(type)) {
      if (!this.world.hasComponent(this.entity, type.engine)) {
        this.world.addComponent(this.entity, type.engine, ...args);
      }
      return type.create(this.world, this.entity);
    }
    const existing: object | undefined = this.world.getComponent(this.entity, type);
    return existing !== undefined ? existing : this.world.addComponent(this.entity, type, ...args);
  }

  public removeComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): void {
    this.world.removeComponent(this.entity, isScriptComponentToken(type) ? type.engine : type);
  }

  public requireComponent<TApi, TEngine extends object>(type: ScriptComponentToken<TApi, TEngine, any[]>): TApi;
  public requireComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent;
  public requireComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): unknown {
    const component: unknown = this.getComponent(type as Component<object, any[]>);
    if (component === undefined) {
      const name: string = isScriptComponentToken(type) ? type.engine.name : type.name;
      throw new Error(`[GameEntity] Required component "${name}" is missing on entity "${this.entity}".`);
    }
    return component;
  }

  public getScript<T extends AtlasScript>(type: ScriptConstructor<T>): T | undefined {
    return this.scripts.getScript(this.entity, type);
  }
}

export function createGameEntity(
  entity: Entity,
  world: NexusWorld,
  scripts: ScriptResolver,
): GameEntity {
  return new GameEntityHandle(entity, world, scripts);
}
```

- [ ] **Step 4: Exporter depuis le barrel core**

Dans `packages/gameplay/src/scripting/core/index.ts`, ajouter la ligne :

```ts
export * from "./GameEntity";
```

- [ ] **Step 5: `ScriptManager implements ScriptResolver`**

Dans `packages/gameplay/src/scripting/runtime/ScriptManager.ts` :

1. Ajouter `ScriptResolver` à l'import depuis `../core` :

```ts
import {
  AtlasScript,
  ExposeFieldMetadata,
  ScriptConstructor,
  ScriptID,
  ScriptInstanceRecord,
  ScriptMetadata,
  ScriptResolver,
  getScriptMetadata,
} from "../core";
```

2. Modifier la déclaration de classe :

```ts
export class ScriptManager implements ScriptResolver {
```

La méthode `getScript` (Task 2) satisfait déjà la signature de `ScriptResolver`.

- [ ] **Step 6: Lancer le test → passe**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/game-entity.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Typecheck & hand off**

Run: `pnpm --filter @atlasjs/gameplay typecheck`
Expected: vert (pas de cycle runtime — `GameEntity` n'importe `AtlasScript`/`ScriptConstructor` qu'en type).

```bash
git add packages/gameplay/src/scripting/core/GameEntity.ts \
        packages/gameplay/src/scripting/core/index.ts \
        packages/gameplay/src/scripting/runtime/ScriptManager.ts \
        packages/gameplay/test/game-entity.test.ts
```
Message suggéré : `feat(scripting): GameEntity handle + ScriptResolver + createGameEntity`.

---

## Task 4: `RuntimeScriptContext` délègue à `GameEntity` + `getEntity` (script → autre entité)

**Files:**
- Modify: `packages/gameplay/src/scripting/core/ScriptContext.ts` (ajout `getEntity`)
- Modify: `packages/gameplay/src/scripting/core/AtlasScript.ts` (passthrough `getEntity`)
- Modify: `packages/gameplay/src/scripting/runtime/RuntimeScriptContext.ts` (4ᵉ param, délégation, `getEntity`)
- Modify: `packages/gameplay/src/scripting/runtime/ScriptManager.ts:56-60` (passe `this` au contexte)
- Test: `packages/gameplay/test/script-get-entity.test.ts` (créer)
- Régression: `packages/gameplay/test/script-context-dispatch.test.ts`

**Interfaces:**
- Consumes: `GameEntity`, `ScriptResolver`, `createGameEntity` (Task 3).
- Produces:
  - `ScriptContext.getEntity(entity: Entity): GameEntity`
  - `AtlasScript.getEntity(entity: Entity): GameEntity`
  - `new RuntimeScriptContext(entity, world, services, scripts: ScriptResolver)`

- [ ] **Step 1: Écrire le test (échoue)**

Créer `packages/gameplay/test/script-get-entity.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { Transform2D } from "../src/components";
import { AtlasScript, GameEntity, Transform } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class Target extends AtlasScript {
  public hp: number = 42;
}

class Controller extends AtlasScript {
  public otherEntity!: Entity;
  public otherId: Entity | undefined;
  public otherScript: Target | undefined;
  public otherX: number | undefined;

  public onCreate(): void {
    const ge: GameEntity = this.getEntity(this.otherEntity);
    this.otherId = ge.id;
    this.otherScript = ge.getScript(Target);
    ge.addComponent(Transform).setPosition(9, 0);
    this.otherX = ge.requireComponent(Transform).position.x;
  }
}

describe("AtlasScript.getEntity", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("wraps another entity and resolves its components and scripts", () => {
    const target: Entity = h.world.createEntity();
    const t: Target = h.scripts.attach(target, Target);

    const ctrlEntity: Entity = h.world.createEntity();
    const ctrl: Controller = h.scripts.attach(ctrlEntity, Controller);
    ctrl.otherEntity = target;

    h.frame();

    expect(ctrl.otherId).toBe(target);
    expect(ctrl.otherScript).toBe(t);
    expect(ctrl.otherX).toBe(9);
    expect(h.world.requireComponent(target, Transform2D).position.x).toBe(9);
  });
});
```

- [ ] **Step 2: Lancer le test → échoue**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/script-get-entity.test.ts`
Expected: FAIL — `this.getEntity is not a function`.

- [ ] **Step 3: Étendre `ScriptContext`**

Dans `packages/gameplay/src/scripting/core/ScriptContext.ts`, ajouter l'import de `GameEntity` et la méthode :

```ts
import { Component, Entity } from "@atlasjs/nexus";

import { GameEntity } from "./GameEntity";
import { ScriptComponentToken } from "./ScriptComponentToken";
import { ScriptServiceCtor } from "./ScriptService";
```

Ajouter dans l'interface (après `getEntityId`) :

```ts
  getEntity(entity: Entity): GameEntity;
```

- [ ] **Step 4: Passthrough sur `AtlasScript`**

Dans `packages/gameplay/src/scripting/core/AtlasScript.ts`, importer `GameEntity` et ajouter la méthode (après `get entityId`) :

```ts
import { GameEntity } from "./GameEntity";
```

```ts
  public getEntity(entity: Entity): GameEntity {
    return this.context.getEntity(entity);
  }
```

- [ ] **Step 5: `RuntimeScriptContext` délègue à `self`**

Réécrire `packages/gameplay/src/scripting/runtime/RuntimeScriptContext.ts` — conserver `getService`/`getEntityId`, déléguer l'accès composant à un `GameEntity` de sa propre entité, ajouter `getEntity` :

```ts
import { ServiceRegistry } from "@atlasjs/core";
import { Component, Entity, NexusWorld } from "@atlasjs/nexus";

import {
  GameEntity,
  ScriptComponentToken,
  ScriptContext,
  ScriptResolver,
  ScriptServiceCtor,
  createGameEntity,
} from "../core";

// prettier-ignore
export class RuntimeScriptContext implements ScriptContext {
  private readonly entity: Entity;
  private readonly world: NexusWorld;
  private readonly services: ServiceRegistry;
  private readonly scripts: ScriptResolver;
  private readonly self: GameEntity;

  public constructor(entity: Entity, world: NexusWorld, services: ServiceRegistry, scripts: ScriptResolver) {
    this.entity = entity;
    this.world = world;
    this.services = services;
    this.scripts = scripts;
    this.self = createGameEntity(entity, world, scripts);
  }

  public getEntityId(): Entity {
    return this.entity;
  }

  public getEntity(entity: Entity): GameEntity {
    return createGameEntity(entity, this.world, this.scripts);
  }

  public getService<TFacade, TService>(type: ScriptServiceCtor<TFacade, TService>): TFacade {
    return new type(this.services);
  }

  public hasComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): boolean {
    return this.self.hasComponent(type);
  }

  public getComponent<TApi, TEngine extends object>(type: ScriptComponentToken<TApi, TEngine, any[]>): TApi | undefined;
  public getComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent | undefined;
  public getComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): unknown {
    return this.self.getComponent(type as Component<object, any[]>);
  }

  public addComponent<TApi, TEngine extends object, TArgs extends unknown[]>(type: ScriptComponentToken<TApi, TEngine, TArgs>, ...args: TArgs): TApi;
  public addComponent<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs>, ...args: TArgs): TComponent;
  public addComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>, ...args: any[]): unknown {
    return this.self.addComponent(type as Component<object, any[]>, ...args);
  }

  public removeComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): void {
    this.self.removeComponent(type);
  }
}
```

- [ ] **Step 6: `ScriptManager.attach` passe `this` au contexte**

Dans `packages/gameplay/src/scripting/runtime/ScriptManager.ts`, modifier la construction du contexte (~lignes 56-60) :

```ts
const context: RuntimeScriptContext = new RuntimeScriptContext(
  entityId,
  this.world,
  this.services,
  this,
);
```

- [ ] **Step 7: Lancer le test + régression → passent**

Run:
```bash
pnpm --filter @atlasjs/gameplay exec vitest run test/script-get-entity.test.ts test/script-context-dispatch.test.ts
```
Expected: PASS (nouveau test + régression du dispatch façade/raw inchangée).

- [ ] **Step 8: Suite complète + typecheck & hand off**

Run:
```bash
pnpm --filter @atlasjs/gameplay test
pnpm --filter @atlasjs/gameplay typecheck
```
Expected: verts.

```bash
git add packages/gameplay/src/scripting/core/ScriptContext.ts \
        packages/gameplay/src/scripting/core/AtlasScript.ts \
        packages/gameplay/src/scripting/runtime/RuntimeScriptContext.ts \
        packages/gameplay/src/scripting/runtime/ScriptManager.ts \
        packages/gameplay/test/script-get-entity.test.ts
```
Message suggéré : `feat(scripting): RuntimeScriptContext delegates to GameEntity + AtlasScript.getEntity`.

---

## Task 5: Injection d'entités (`injectProps` + typage `AttachProps`)

**Files:**
- Modify: `packages/gameplay/src/scripting/runtime/ScriptManager.ts` (import, `AttachProps`/`PropsOfArgs` ~lignes 18-20, `injectProps` ~lignes 194-202)
- Test: `packages/gameplay/test/entity-prop-injection.test.ts` (créer)

**Interfaces:**
- Consumes: `createGameEntity`, `GameEntity`, `ExposeFieldMetadata` (core), `Entity` (nexus).
- Produces: un champ metadata `entity` est wrappé en `GameEntity` à l'injection ; au call site, `attach` accepte une `Entity` brute là où le script déclare `GameEntity`.

- [ ] **Step 1: Écrire le test (échoue)**

Créer `packages/gameplay/test/entity-prop-injection.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Entity } from "@atlasjs/nexus";
import { Logger } from "@atlasjs/utils";

import {
  AtlasScript,
  GameEntity,
  ScriptManager,
  ScriptMetadata,
  Transform,
  registerScriptMetadata,
} from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class Piloted extends AtlasScript {
  public hp: number = 7;
}

class Pilot extends AtlasScript<{ target: GameEntity }> {
  public target!: GameEntity;
  public targetScript: Piloted | undefined;
  public targetX: number | undefined;

  public onCreate(): void {
    this.targetScript = this.target.getScript(Piloted);
    this.target.addComponent(Transform).setPosition(3, 4);
    this.targetX = this.target.requireComponent(Transform).position.x;
  }
}
registerScriptMetadata(Pilot, {
  exposed: { target: ScriptMetadata.entity({ required: true }) },
});

describe("attach — entity ref injection", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("wraps a raw Entity prop into a GameEntity handle", () => {
    const target: Entity = h.world.createEntity();
    const tScript: Piloted = h.scripts.attach(target, Piloted);

    const pilotEntity: Entity = h.world.createEntity();
    const pilot: Pilot = h.scripts.attach(pilotEntity, Pilot, { target });

    h.frame();

    expect(pilot.target.id).toBe(target);
    expect(pilot.targetScript).toBe(tScript);
    expect(pilot.targetX).toBe(3);
  });

  it("warns when a required entity ref is missing", () => {
    const warn = vi.fn();
    const logger: Logger = {
      warn,
      error: vi.fn(),
      log: vi.fn(),
      debug: vi.fn(),
    } as unknown as Logger;
    const sm: ScriptManager = new ScriptManager(h.world, h.services, logger);
    const e: Entity = h.world.createEntity();

    sm.attach(e, Pilot, {} as { target: Entity });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("target");
  });

  it("type: accepts a raw Entity at the call site, rejects a non-Entity", () => {
    const target: Entity = h.world.createEntity();
    const e: Entity = h.world.createEntity();

    h.scripts.attach(e, Pilot, { target });
    // @ts-expect-error — a plain object is not an Entity
    h.scripts.attach(e, Pilot, { target: {} });
  });
});
```

- [ ] **Step 2: Lancer le test → échoue**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/entity-prop-injection.test.ts`
Expected: FAIL — `pilot.target.id` explose (le champ contient l'`Entity` brute, pas un handle) / `getScript` absent.

- [ ] **Step 3: Ajouter les imports + `AttachProps`**

Dans `packages/gameplay/src/scripting/runtime/ScriptManager.ts`, ajouter `GameEntity` et `createGameEntity` à l'import `../core` :

```ts
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
```

Remplacer les types utilitaires (~lignes 18-20) :

```ts
type PropsOf<T> = T extends AtlasScript<infer P> ? P : {};
type AttachProps<P> = { [K in keyof P]: P[K] extends GameEntity ? Entity : P[K] };
type PropsOfArgs<T> =
  {} extends AttachProps<PropsOf<T>>
    ? [props?: AttachProps<PropsOf<T>>]
    : [props: AttachProps<PropsOf<T>>];
```

- [ ] **Step 4: Wrapper les champs `entity` dans `injectProps`**

Dans `injectProps`, remplacer la boucle d'assignation (~lignes 194-202) :

```ts
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
```

(La boucle « clé fournie non exposée » qui suit est inchangée.)

- [ ] **Step 5: Lancer le test → passe**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/entity-prop-injection.test.ts`
Expected: PASS (3 tests, dont le test de type via `@ts-expect-error`).

- [ ] **Step 6: Suite complète + typecheck & hand off**

Run:
```bash
pnpm --filter @atlasjs/gameplay test
pnpm --filter @atlasjs/gameplay typecheck
```
Expected: verts (le `@ts-expect-error` du test est validé par `typecheck`).

```bash
git add packages/gameplay/src/scripting/runtime/ScriptManager.ts \
        packages/gameplay/test/entity-prop-injection.test.ts
```
Message suggéré : `feat(scripting): inject entity refs as GameEntity + AttachProps call-site typing`.

---

## Task 6: Câblage sandbox — `TestScript` reçoit et pilote `sword`

**Files:**
- Modify: `apps/sandbox/src/game/scripts/TestScript.ts`
- Modify: `apps/sandbox/src/game/EcsScene.ts:111-116`
- Verify: rebuild dist + preview navigateur

**Interfaces:**
- Consumes: `GameEntity`, `ScriptMetadata.entity` (package), `SwordScript` (sandbox), `SpriteRenderer` (package).

- [ ] **Step 1: `TestScript` déclare, reçoit et pilote `sword`**

Dans `apps/sandbox/src/game/scripts/TestScript.ts` :

1. Ajouter `GameEntity` et `ScriptMetadata` à l'import `@atlasjs/gameplay` (`SwordScript` est déjà dans le dossier `scripts/`, l'importer depuis `./SwordScript`).

```ts
import { SwordScript } from "./SwordScript";
```

2. Ajouter le champ au générique de props et un champ privé :

```ts
export class TestScript extends AtlasScript<{
  sprite: Sprite;
  speed: number;
  controls: PlayerControlsDescriptor;
  clips: Record<string, SpriteAnimation>;
  sword: GameEntity;
}> {
```

```ts
  private sword!: GameEntity;
  private swordScript: SwordScript | undefined;
  private swordRenderer: SpriteRenderer | undefined;
```

3. Dans `onCreate`, résoudre un script **et** un composant de l'épée (preuve d'accès cross-entité), après les `addComponent` existants — la présence du `SwordScript` sert ensuite de garde :

```ts
    this.swordScript = this.sword.getScript(SwordScript);
    this.swordRenderer = this.sword.getComponent(SpriteRenderer);
```

4. Dans `onUpdate`, teinter le sprite de l'épée selon le boost — **uniquement si** l'entité `sword` porte bien un `SwordScript` (le résultat de `getScript` pilote le comportement, sans entrer en conflit avec `SwordScript` qui n'écrit `color` qu'au `onCreate`) :

```ts
    if (this.swordScript !== undefined && this.swordRenderer !== undefined) {
      const boosting: boolean = this.boost.isDown();
      this.swordRenderer.color.set(1, boosting ? 0.4 : 1, boosting ? 0.4 : 1, 1);
    }
```

Le champ `sword: GameEntity` reste déclaré au générique de props ; `this.sword` est le handle injecté (utilisé au `onCreate`).

5. Ajouter le champ à la metadata :

```ts
registerScriptMetadata(TestScript, {
  exposed: {
    sprite: ScriptMetadata.field({ required: true }),
    clips: ScriptMetadata.field({ required: true }),
    speed: ScriptMetadata.field({ required: true }),
    controls: ScriptMetadata.field({ required: true }),
    sword: ScriptMetadata.entity({ required: true }),
  },
});
```

- [ ] **Step 2: `EcsScene` passe `sword` à `TestScript`**

Dans `apps/sandbox/src/game/EcsScene.ts`, ajouter `sword` à l'appel `attach(player, TestScript, …)` (~lignes 111-116) :

```ts
    scriptManager.attach(player, TestScript, {
      clips,
      controls,
      sprite: blueDinoSprite,
      speed: 250,
      sword,
    });
```

(`sword` est déjà créé plus haut, `nexus.createEntity()`, et attaché à `SwordScript` + reparenté au `player` — inchangé.)

- [ ] **Step 3: Rebuild dist + typecheck sandbox**

Run:
```bash
pnpm --filter @atlasjs/gameplay build
pnpm --filter sandbox exec tsc --noEmit
```
Expected: verts (dist régénéré pour exposer `GameEntity`/`ScriptMetadata` à la sandbox).

- [ ] **Step 4: Vérifier dans le navigateur**

Démarrer le serveur de dev via `preview_start` (`{ name: "sandbox" }`, en créant l'entrée `.claude/launch.json` `sandbox` → `vite`, port du projet si absente), puis :
- `read_console_messages` → aucune erreur.
- Interagir : maintenir **Space** (boost) → le sprite de l'épée vire au rouge, relâcher → couleur normale. (Preuve visuelle de la mutation cross-entité `this.sword.getComponent(SpriteRenderer)`.)
- `computer { action: "screenshot" }` → capture partagée à l'utilisateur.

- [ ] **Step 5: Hand off**

```bash
git add apps/sandbox/src/game/scripts/TestScript.ts \
        apps/sandbox/src/game/EcsScene.ts
```
Message suggéré : `feat(sandbox): pass sword entity to TestScript and drive it via GameEntity`.

---

## Self-Review

**Couverture de la spec :**
- §2.1 `GameEntity` (interface + factory, stateless) → Task 3 ✅
- §2.2 `getScript` côté `ScriptManager` (instanceof, ignore détruits) → Task 2 ✅
- §2.3 union discriminée + `ScriptMetadata.field()/.entity()` → Task 1 ✅
- §2.4 typage `AttachProps` + `injectProps` dispatch `type` → Task 5 ✅
- §2.5 `RuntimeScriptContext` délègue + `getEntity` runtime + `AtlasScript.getEntity` → Task 4 ✅
- §5 layering sans cycle (`ScriptResolver` en core) → Task 3 ✅
- §3 exemple sandbox → Task 6 ✅
- §4 caveats (ordre de création, staleness) → couverts par les tests (getScript pré-`onCreate` via ordre d'attach ; entité détruite → `undefined` dans `get-script.test.ts`).

**Placeholders :** aucun — chaque step porte le code/commande réel. ✅

**Cohérence des types :** signature `getScript(entity, type)` identique entre Task 2 (impl), Task 3 (`ScriptResolver`), et `GameEntity.getScript(type)` (délègue à `scripts.getScript(this.entity, type)`). `createGameEntity(entity, world, scripts)` — même ordre d'arguments dans `GameEntity.ts`, `RuntimeScriptContext`, et `injectProps`. `AttachProps<PropsOf<T>>` cohérent entre `PropsOfArgs` et l'usage `attach`. ✅

**Note honnête sur l'anti-duplication (§1 décision 6) :** ce refactor consolide l'**implémentation** du dispatch token/composant en un seul endroit (`GameEntityHandle`) ; les **signatures** d'overloads restent déclarées sur chaque surface (`GameEntity`, `ScriptContext`, `RuntimeScriptContext`, `AtlasScript`) car un impl à signature large ne satisfait pas des overloads à retour typé. Le gain est comportemental (un seul corps), pas la suppression des déclarations.
