# Prefab & Instantiation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de créer une entité à l'exécution depuis un script, à partir d'un prefab code-first typé (`this.instantiate(Prefab, params)`), avec le companion `destroy`.

**Architecture:** Un `Prefab<TParams>` est une valeur décrivant un `build(entity, params)`. Un service `Instantiator` (world + `ScriptManager`) crée l'entité racine, exécute `build` via un `EntityBuilder` (`add` = `GameEntity.addComponent`, `attach` = `ScriptManager.attach`), et retourne un `GameEntity`. `destroy` est différé (marche du sous-arbre pour les scripts + `world.commands.destroy` récursif). Le tout est exposé aux scripts via `AtlasScript.instantiate`/`destroy` → `RuntimeScriptContext` qui résout `INSTANTIATOR` paresseusement (casse le cycle `ScriptManager ↔ Instantiator`).

**Tech Stack:** TypeScript, `@atlasjs/gameplay` (Nexus ECS + scripting), vitest (`test/helpers/harness.ts`), tsdown.

**Spec source:** [`docs/gameplay/prefab.md`](prefab.md).

## Global Constraints

- **Tout est typé** : paramètres de fonction, variables locales, champs de classe — même si trivial (règle repo).
- **Aucun commentaire** dans le code (règle repo). Utiliser `// prettier-ignore` au-dessus des blocs d'overloads denses, comme le code existant.
- **Package unique** : tout dans `@atlasjs/gameplay`. Aucune nouvelle dépendance inter-packages. **Aucun cycle d'import** — les imports qui ne servent qu'au typage sont `import type` (obligatoire pour `Instantiator` dans `tokens.ts` et `RuntimeScriptContext`, et pour `ScriptManager` dans `tokens.ts`).
- **Typecheck** : `pnpm --filter @atlasjs/gameplay exec tsc --noEmit` — **jamais** `tsc -b` (émet des artefacts à côté des sources).
- **Tests** : `pnpm --filter @atlasjs/gameplay test` (vitest ; `createHarness()` boote un vrai `Engine` + `GameplayPlugin`, expose `world`/`scripts`/`services`/`frame(ticks?)`).
- **Build** : `pnpm --filter @atlasjs/gameplay build` (tsdown → `dist`). À refaire quand l'API publique change (§Task 4) pour que la sandbox Vite résolve les nouveaux exports.
- **Prefab = valeur pure** : aucune I/O, aucun chargement d'asset dans `definePrefab`.
- **Différé-compatible** : `onCreate` des scripts spawnés au prochain `flushCreates` ; `destroy` via le command buffer (flush au `Sync`). Ne jamais détruire une entité immédiatement en plein `onUpdate`.
- **Formatage** : lancer `pnpm format` avant de mettre en stage (le repo n'a pas de config prettier → défauts prettier 3 ; évite le churn du format-on-save).
- **Commits** : ne **pas** committer automatiquement (règle repo pour les skills superpowers). Chaque tâche se termine par : tests verts + typecheck OK, puis remise à l'utilisateur pour revue/commit (message suggéré fourni).

---

### Task 1: Modèle `Prefab` + `Instantiator.instantiate`

Le cœur : créer une entité, exécuter le `build`, appliquer les params, gérer l'option `parent`, retourner un `GameEntity`. Pas encore de `destroy`, pas encore de branchement scripts/plugin.

**Files:**
- Create: `packages/gameplay/src/prefab/Prefab.ts`
- Create: `packages/gameplay/src/prefab/EntityBuilder.ts`
- Create: `packages/gameplay/src/prefab/Instantiator.ts`
- Create: `packages/gameplay/src/prefab/index.ts`
- Modify: `packages/gameplay/src/scripting/runtime/ScriptManager.ts` (exporter les types d'args d'`attach`)
- Test: `packages/gameplay/test/prefab-instantiate.test.ts`

**Interfaces:**
- Consumes : `NexusWorld.createEntity()/setParent()`, `GameEntity.addComponent` (via `createGameEntity`), `ScriptManager.attach(entity, Script, ...rest)`.
- Produces :
  - `type Prefab<TParams = void> = { readonly name?: string; build(entity: EntityBuilder, params: TParams): void }`
  - `function definePrefab<TParams = void>(def): Prefab<TParams>`
  - `interface EntityBuilder { readonly entity: Entity; add(...): instance; attach(...): script }`
  - `class PrefabEntityBuilder implements EntityBuilder`
  - `class Instantiator { constructor(world, scripts); instantiate<TParams>(prefab, ...rest: InstantiateArgs<TParams>): GameEntity }`
  - `type InstantiateOptions = { parent?: Entity }`
  - `type InstantiateArgs<TParams>` (tuple conditionnel : params optionnels ssi `TParams` est `void`)
  - `type AttachArgs<T>` exporté depuis `ScriptManager.ts`

- [ ] **Step 1: Exporter les types d'args d'`attach` depuis `ScriptManager.ts`**

Dans `packages/gameplay/src/scripting/runtime/ScriptManager.ts`, remplacer les types locaux (lignes ~21-28) par des exports réutilisables et mettre à jour la signature d'`attach`.

Remplacer :

```ts
type PropsOf<T> = T extends AtlasScript<infer P> ? P : {};
type AttachProps<P> = {
  [K in keyof P]: P[K] extends GameEntity ? Entity : P[K];
};
type PropsOfArgs<T> =
  {} extends AttachProps<PropsOf<T>>
    ? [props?: AttachProps<PropsOf<T>>]
    : [props: AttachProps<PropsOf<T>>];
```

par :

```ts
type PropsOf<T> = T extends AtlasScript<infer P> ? P : {};

export type AttachProps<P> = {
  [K in keyof P]: P[K] extends GameEntity ? Entity : P[K];
};

export type AttachArgs<T> =
  {} extends AttachProps<PropsOf<T>>
    ? [props?: AttachProps<PropsOf<T>>]
    : [props: AttachProps<PropsOf<T>>];
```

Puis dans la signature de `attach`, remplacer `...rest: PropsOfArgs<TScript>` par `...rest: AttachArgs<TScript>`.

- [ ] **Step 2: Écrire `Prefab.ts`**

`packages/gameplay/src/prefab/Prefab.ts` :

```ts
import type { EntityBuilder } from "./EntityBuilder";

export type Prefab<TParams = void> = {
  readonly name?: string;
  build(entity: EntityBuilder, params: TParams): void;
};

export function definePrefab<TParams = void>(def: {
  name?: string;
  build(entity: EntityBuilder, params: TParams): void;
}): Prefab<TParams> {
  return def;
}
```

- [ ] **Step 3: Écrire `EntityBuilder.ts`**

`packages/gameplay/src/prefab/EntityBuilder.ts` :

```ts
import { Component, Entity, NexusWorld } from "@atlasjs/nexus";

import {
  AtlasScript,
  GameEntity,
  ScriptComponentToken,
  ScriptConstructor,
  createGameEntity,
} from "../scripting/core";
import type { AttachArgs, ScriptManager } from "../scripting/runtime";

// prettier-ignore
export interface EntityBuilder {
  readonly entity: Entity;
  add<TApi, TEngine extends object, TArgs extends unknown[]>(type: ScriptComponentToken<TApi, TEngine, TArgs>, ...args: TArgs): TApi;
  add<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs>, ...args: TArgs): TComponent;
  attach<TScript extends AtlasScript>(Script: ScriptConstructor<TScript>, ...rest: AttachArgs<TScript>): TScript;
}

// prettier-ignore
export class PrefabEntityBuilder implements EntityBuilder {
  public readonly entity: Entity;
  private readonly self: GameEntity;
  private readonly scripts: ScriptManager;

  public constructor(entity: Entity, world: NexusWorld, scripts: ScriptManager) {
    this.entity = entity;
    this.self = createGameEntity(entity, world, scripts);
    this.scripts = scripts;
  }

  public add<TApi, TEngine extends object, TArgs extends unknown[]>(type: ScriptComponentToken<TApi, TEngine, TArgs>, ...args: TArgs): TApi;
  public add<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs>, ...args: TArgs): TComponent;
  public add(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>, ...args: any[]): unknown {
    return this.self.addComponent(type as Component<object, any[]>, ...args);
  }

  public attach<TScript extends AtlasScript>(Script: ScriptConstructor<TScript>, ...rest: AttachArgs<TScript>): TScript {
    return this.scripts.attach(this.entity, Script, ...rest);
  }
}
```

- [ ] **Step 4: Écrire `Instantiator.ts` (instantiate uniquement)**

`packages/gameplay/src/prefab/Instantiator.ts` :

```ts
import { Entity, NexusWorld } from "@atlasjs/nexus";

import { GameEntity, createGameEntity } from "../scripting/core";
import type { ScriptManager } from "../scripting/runtime";

import { PrefabEntityBuilder } from "./EntityBuilder";
import type { Prefab } from "./Prefab";

export type InstantiateOptions = { parent?: Entity };

export type InstantiateArgs<TParams> = [TParams] extends [void]
  ? [params?: undefined, options?: InstantiateOptions]
  : [params: TParams, options?: InstantiateOptions];

// prettier-ignore
export class Instantiator {
  private readonly world: NexusWorld;
  private readonly scripts: ScriptManager;

  public constructor(world: NexusWorld, scripts: ScriptManager) {
    this.world = world;
    this.scripts = scripts;
  }

  public instantiate<TParams>(prefab: Prefab<TParams>, ...rest: InstantiateArgs<TParams>): GameEntity {
    const params: TParams = rest[0] as TParams;
    const options: InstantiateOptions | undefined = rest[1] as InstantiateOptions | undefined;

    const root: Entity = this.world.createEntity();
    const builder: PrefabEntityBuilder = new PrefabEntityBuilder(root, this.world, this.scripts);

    prefab.build(builder, params);

    if (options?.parent !== undefined) {
      this.world.setParent(root, options.parent);
    }

    return createGameEntity(root, this.world, this.scripts);
  }
}
```

- [ ] **Step 5: Écrire le barrel `prefab/index.ts`**

`packages/gameplay/src/prefab/index.ts` :

```ts
export * from "./Prefab";
export * from "./EntityBuilder";
export * from "./Instantiator";
```

- [ ] **Step 6: Écrire les tests (doivent échouer)**

`packages/gameplay/test/prefab-instantiate.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import { Transform2D } from "../src";
import { AtlasScript } from "../src/scripting";
import { definePrefab, Instantiator } from "../src/prefab";
import { createHarness, Harness } from "./helpers/harness";

describe("Instantiator.instantiate", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("adds components and applies params", () => {
    const prefab = definePrefab<{ x: number }>({
      build(entity, params): void {
        entity.add(Transform2D).position.set(params.x, 0);
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);
    const id: Entity = inst.instantiate(prefab, { x: 42 }).id;

    const transform: Transform2D = h.world.getComponent(id, Transform2D)!;
    expect(transform.position.x).toBe(42);
  });

  it("attaches scripts declared in build", () => {
    class Marker extends AtlasScript {
      public created: boolean = false;
      public onCreate(): void {
        this.created = true;
      }
    }

    const prefab = definePrefab({
      build(entity): void {
        entity.attach(Marker);
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);
    const id: Entity = inst.instantiate(prefab).id;
    h.frame();

    expect(h.scripts.getScript(id, Marker)?.created).toBe(true);
  });

  it("parents the root when options.parent is given", () => {
    const parent: Entity = h.world.createEntity();
    const prefab = definePrefab({
      build(entity): void {
        entity.add(Transform2D);
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);
    const id: Entity = inst.instantiate(prefab, undefined, { parent }).id;

    expect(h.world.getParent(id)).toBe(parent);
  });
});
```

- [ ] **Step 7: Lancer les tests — vérifier l'échec**

Run: `pnpm --filter @atlasjs/gameplay test prefab-instantiate`
Expected: FAIL (`Cannot find module "../src/prefab"` ou équivalent).

- [ ] **Step 8: Lancer les tests — vérifier le succès**

Une fois les steps 1-5 en place :
Run: `pnpm --filter @atlasjs/gameplay test prefab-instantiate`
Expected: PASS (3 tests).

- [ ] **Step 9: Typecheck**

Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 10: Formater + remettre pour revue**

Run: `pnpm format`
Puis présenter à l'utilisateur pour commit (ne pas committer). Message suggéré :
`feat(gameplay): prefab model + Instantiator.instantiate`

---

### Task 2: `destroy` (companion)

`destroy` sur `GameEntity` (auto-suffisant), l'extension minimale de `ScriptResolver`, et `Instantiator.destroy`.

**Files:**
- Modify: `packages/gameplay/src/scripting/core/GameEntity.ts` (interface `ScriptResolver` + interface `GameEntity` + `GameEntityHandle`)
- Modify: `packages/gameplay/src/scripting/runtime/ScriptManager.ts` (implémenter `destroyEntityScripts`)
- Modify: `packages/gameplay/src/prefab/Instantiator.ts` (méthode `destroy`)
- Test: `packages/gameplay/test/prefab-destroy.test.ts`

**Interfaces:**
- Consumes : `NexusWorld.getChildren(entity)`, `NexusWorld.commands.destroy(entity)` (différé, garde `exists`, récursif), `ScriptManager.destroyAllByEntity`.
- Produces :
  - `ScriptResolver.destroyEntityScripts(entityId: Entity): void`
  - `GameEntity.destroy(): void`
  - `Instantiator.destroy(entity: Entity): void`

- [ ] **Step 1: Écrire les tests (doivent échouer)**

`packages/gameplay/test/prefab-destroy.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import { Transform2D } from "../src";
import { AtlasScript, createGameEntity } from "../src/scripting";
import { Instantiator } from "../src/prefab";
import { createHarness, Harness } from "./helpers/harness";

describe("GameEntity.destroy / Instantiator.destroy", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("removes the entity after a frame", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);

    createGameEntity(e, h.world, h.scripts).destroy();
    h.frame();

    expect(h.world.exists(e)).toBe(false);
  });

  it("fires onDestroy of the entity's scripts", () => {
    let destroyed: boolean = false;
    class Dying extends AtlasScript {
      public onDestroy(): void {
        destroyed = true;
      }
    }

    const e: Entity = h.world.createEntity();
    h.scripts.attach(e, Dying);
    h.frame();

    createGameEntity(e, h.world, h.scripts).destroy();
    h.frame();

    expect(destroyed).toBe(true);
  });

  it("recurses into children entities and their scripts", () => {
    let childDestroyed: boolean = false;
    class ChildScript extends AtlasScript {
      public onDestroy(): void {
        childDestroyed = true;
      }
    }

    const parent: Entity = h.world.createEntity();
    h.world.addComponent(parent, Transform2D);
    const child: Entity = h.world.createEntity();
    h.world.addComponent(child, Transform2D);
    h.world.setParent(child, parent);
    h.scripts.attach(child, ChildScript);
    h.frame();

    createGameEntity(parent, h.world, h.scripts).destroy();
    h.frame();

    expect(childDestroyed).toBe(true);
    expect(h.world.exists(child)).toBe(false);
    expect(h.world.exists(parent)).toBe(false);
  });

  it("Instantiator.destroy destroys the entity", () => {
    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);

    new Instantiator(h.world, h.scripts).destroy(e);
    h.frame();

    expect(h.world.exists(e)).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer les tests — vérifier l'échec**

Run: `pnpm --filter @atlasjs/gameplay test prefab-destroy`
Expected: FAIL (`destroy is not a function` sur le handle).

- [ ] **Step 3: Étendre `ScriptResolver` + `GameEntity` + `GameEntityHandle`**

Dans `packages/gameplay/src/scripting/core/GameEntity.ts` :

Ajouter à l'interface `ScriptResolver` :

```ts
// prettier-ignore
export interface ScriptResolver {
  getScript<T extends AtlasScript>(entityId: Entity, type: ScriptConstructor<T>): T | undefined;
  destroyEntityScripts(entityId: Entity): void;
}
```

Ajouter à l'interface `GameEntity` (après `getScript`) :

```ts
  destroy(): void;
```

Ajouter à la classe `GameEntityHandle` (le champ `world`/`scripts` existent déjà) :

```ts
  public destroy(): void {
    this.destroySubtreeScripts(this.entity);
    this.world.commands.destroy(this.entity);
  }

  private destroySubtreeScripts(entity: Entity): void {
    const children: ReadonlyArray<Entity> = this.world.getChildren(entity);
    for (let i: number = 0; i < children.length; i++) {
      this.destroySubtreeScripts(children[i]);
    }
    this.scripts.destroyEntityScripts(entity);
  }
```

- [ ] **Step 4: Implémenter `destroyEntityScripts` sur `ScriptManager`**

Dans `packages/gameplay/src/scripting/runtime/ScriptManager.ts`, ajouter une méthode publique qui satisfait l'interface (délègue à l'existant `destroyAllByEntity`) :

```ts
  public destroyEntityScripts(entityId: Entity): void {
    this.destroyAllByEntity(entityId);
  }
```

- [ ] **Step 5: Ajouter `Instantiator.destroy`**

Dans `packages/gameplay/src/prefab/Instantiator.ts`, ajouter la méthode :

```ts
  public destroy(entity: Entity): void {
    createGameEntity(entity, this.world, this.scripts).destroy();
  }
```

- [ ] **Step 6: Lancer les tests — vérifier le succès**

Run: `pnpm --filter @atlasjs/gameplay test prefab-destroy`
Expected: PASS (4 tests).

- [ ] **Step 7: Non-régression + typecheck**

Run: `pnpm --filter @atlasjs/gameplay test`
Expected: toute la suite passe (l'ajout à `ScriptResolver` ne casse pas les autres implémenteurs — seul `ScriptManager` l'implémente).
Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 8: Formater + remettre pour revue**

Run: `pnpm format`
Message suggéré : `feat(gameplay): GameEntity.destroy + Instantiator.destroy (deferred, recursive)`

---

### Task 3: API script (`this.instantiate` / `this.destroy`) + câblage plugin

Exposer aux scripts, brancher le service `INSTANTIATOR`, casser le cycle d'import.

**Files:**
- Modify: `packages/gameplay/src/tokens.ts` (token `INSTANTIATOR` + `import type` pour `ScriptManager`)
- Modify: `packages/gameplay/src/scripting/core/ScriptContext.ts` (déclarations `instantiate`/`destroy`)
- Modify: `packages/gameplay/src/scripting/core/AtlasScript.ts` (méthodes `instantiate`/`destroy`)
- Modify: `packages/gameplay/src/scripting/runtime/RuntimeScriptContext.ts` (implémentation)
- Modify: `packages/gameplay/src/GameplayPlugin.ts` (construire + fournir `INSTANTIATOR`)
- Test: `packages/gameplay/test/prefab-script-api.test.ts`

**Interfaces:**
- Consumes : `Instantiator`, `InstantiateArgs`, `Prefab` (Task 1) ; `GameEntity.destroy` (Task 2) ; `ServiceRegistry.get`, `ServiceRegistry.provide`.
- Produces :
  - Token `INSTANTIATOR: ServiceToken<Instantiator>`
  - `AtlasScript.instantiate<TParams>(prefab, ...rest): GameEntity` + `AtlasScript.destroy(): void`
  - `ScriptContext.instantiate` + `ScriptContext.destroy`

- [ ] **Step 1: Écrire les tests (doivent échouer)**

`packages/gameplay/test/prefab-script-api.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import { Transform2D } from "../src";
import { AtlasScript } from "../src/scripting";
import { definePrefab } from "../src/prefab";
import { createHarness, Harness } from "./helpers/harness";

describe("AtlasScript.instantiate / destroy", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("instantiates a prefab through the runtime, params flowing to build", () => {
    const prefab = definePrefab<{ x: number }>({
      build(entity, params): void {
        entity.add(Transform2D).position.set(params.x, 0);
      },
    });

    let spawned: Entity | undefined;
    class Spawner extends AtlasScript {
      public onCreate(): void {
        spawned = this.instantiate(prefab, { x: 7 }).id;
      }
    }

    const e: Entity = h.world.createEntity();
    h.scripts.attach(e, Spawner);
    h.frame();

    expect(spawned).toBeDefined();
    expect(h.world.getComponent(spawned!, Transform2D)!.position.x).toBe(7);
  });

  it("destroys its own entity via this.destroy()", () => {
    class SelfKill extends AtlasScript {
      public onUpdate(): void {
        this.destroy();
      }
    }

    const e: Entity = h.world.createEntity();
    h.world.addComponent(e, Transform2D);
    h.scripts.attach(e, SelfKill);
    h.frame();

    expect(h.world.exists(e)).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer les tests — vérifier l'échec**

Run: `pnpm --filter @atlasjs/gameplay test prefab-script-api`
Expected: FAIL (`this.instantiate is not a function`).

- [ ] **Step 3: Ajouter le token `INSTANTIATOR` + `import type` pour `ScriptManager`**

Réécrire `packages/gameplay/src/tokens.ts` :

```ts
import { ServiceRegistry, ServiceToken } from "@atlasjs/core";

import type { ScriptManager } from "./scripting";
import type { Instantiator } from "./prefab";

export const SCRIPT_MANAGER: ServiceToken<ScriptManager> =
  ServiceRegistry.createToken("SCRIPT_MANAGER");

export const INSTANTIATOR: ServiceToken<Instantiator> =
  ServiceRegistry.createToken("INSTANTIATOR");
```

> Le passage de `import { ScriptManager }` à `import type { ScriptManager }` est requis : il transforme l'arête `tokens → scripting` en type-only (effacée au runtime), sinon `RuntimeScriptContext → tokens → scripting` formerait un cycle runtime `scripting ↔ tokens`.

- [ ] **Step 4: Déclarer `instantiate`/`destroy` sur `ScriptContext`**

Dans `packages/gameplay/src/scripting/core/ScriptContext.ts`, ajouter les imports de types et les deux membres.

Ajouter en tête :

```ts
import type { Prefab } from "../../prefab/Prefab";
import type { InstantiateArgs } from "../../prefab/Instantiator";
```

Ajouter dans l'interface (après `removeComponent`) :

```ts
  instantiate<TParams>(prefab: Prefab<TParams>, ...rest: InstantiateArgs<TParams>): GameEntity;
  destroy(): void;
```

- [ ] **Step 5: Ajouter `instantiate`/`destroy` sur `AtlasScript`**

Dans `packages/gameplay/src/scripting/core/AtlasScript.ts`, ajouter les imports de types :

```ts
import type { Prefab } from "../../prefab/Prefab";
import type { InstantiateArgs } from "../../prefab/Instantiator";
```

Ajouter les méthodes publiques (après `getEntity`) :

```ts
  public instantiate<TParams>(prefab: Prefab<TParams>, ...rest: InstantiateArgs<TParams>): GameEntity {
    return this.context.instantiate(prefab, ...rest);
  }

  public destroy(): void {
    this.context.destroy();
  }
```

- [ ] **Step 6: Implémenter dans `RuntimeScriptContext`**

Dans `packages/gameplay/src/scripting/runtime/RuntimeScriptContext.ts`, ajouter les imports :

```ts
import { INSTANTIATOR } from "../../tokens";
import type { Prefab } from "../../prefab/Prefab";
import type { InstantiateArgs } from "../../prefab/Instantiator";
```

Ajouter les méthodes (après `removeComponent`) :

```ts
  public instantiate<TParams>(prefab: Prefab<TParams>, ...rest: InstantiateArgs<TParams>): GameEntity {
    return this.services.get(INSTANTIATOR).instantiate(prefab, ...rest);
  }

  public destroy(): void {
    this.self.destroy();
  }
```

> `services.get(INSTANTIATOR)` (résolution paresseuse) casse le cycle `ScriptManager ↔ Instantiator` : aucune injection de constructeur. `this.self` est le `GameEntity` déjà détenu par le contexte.

- [ ] **Step 7: Construire et fournir `INSTANTIATOR` dans `GameplayPlugin`**

Dans `packages/gameplay/src/GameplayPlugin.ts` :

Ajouter l'import de valeur :

```ts
import { Instantiator } from "./prefab";
```

Ajouter `INSTANTIATOR` à l'import des tokens :

```ts
import { SCRIPT_MANAGER, INSTANTIATOR } from "./tokens";
```

Ajouter `INSTANTIATOR` au `provides` du constructeur :

```ts
      provides: [SCRIPT_MANAGER, INSTANTIATOR, CAMERA_MANAGER, SORTING_LAYERS],
```

Dans `install`, après la création de `this.scriptManager`, construire l'instantiator :

```ts
    const instantiator: Instantiator = new Instantiator(world, this.scriptManager);
```

Et le fournir, à côté des autres `provide` (avant `this.deferred.resolve()`) :

```ts
    engine.services.provide(INSTANTIATOR, instantiator);
```

- [ ] **Step 8: Lancer les tests — vérifier le succès**

Run: `pnpm --filter @atlasjs/gameplay test prefab-script-api`
Expected: PASS (2 tests).

- [ ] **Step 9: Non-régression + typecheck**

Run: `pnpm --filter @atlasjs/gameplay test`
Expected: toute la suite passe.
Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit`
Expected: aucune erreur (vérifie l'absence de cycle de types et la bonne résolution des `import type`).

- [ ] **Step 10: Formater + remettre pour revue**

Run: `pnpm format`
Message suggéré : `feat(gameplay): script-facing instantiate/destroy + INSTANTIATOR service`

---

### Task 4: Exports publics + intégration bout-en-bout + build

Rendre l'API publique (barrel `src/index`) et prouver la boucle complète « prefab en prop exposé → script instancie avec params ». Rebuild du `dist`.

**Files:**
- Modify: `packages/gameplay/src/index.ts` (exporter `./prefab`)
- Test: `packages/gameplay/test/prefab-exposed-prop.test.ts`

**Interfaces:**
- Consumes : tout ce qui précède + `registerScriptMetadata` / `ScriptMetadata.field` (existants).
- Produces : exports publics `Prefab`, `definePrefab`, `EntityBuilder`, `Instantiator`, `InstantiateOptions`.

- [ ] **Step 1: Exporter le barrel prefab depuis `src/index.ts`**

Dans `packages/gameplay/src/index.ts`, ajouter (à côté des autres `export *`, après `./scripting`) :

```ts
export * from "./prefab";
```

- [ ] **Step 2: Écrire le test d'intégration (doit échouer d'abord si l'export manque)**

`packages/gameplay/test/prefab-exposed-prop.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import {
  AtlasScript,
  Prefab,
  ScriptMetadata,
  Transform2D,
  definePrefab,
  registerScriptMetadata,
} from "../src";
import { createHarness, Harness } from "./helpers/harness";

describe("prefab passed as an exposed prop", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("instantiates with params flowing into an attached script", () => {
    class Bullet extends AtlasScript<{ direction: number }> {
      public direction!: number;
    }
    registerScriptMetadata(Bullet, {
      exposed: { direction: ScriptMetadata.field({ required: true }) },
    });

    const bulletPrefab: Prefab<{ direction: number }> = definePrefab<{
      direction: number;
    }>({
      name: "bullet",
      build(entity, params): void {
        entity.add(Transform2D);
        entity.attach(Bullet, { direction: params.direction });
      },
    });

    let bulletId: Entity | undefined;
    class Shooter extends AtlasScript<{ prefab: Prefab<{ direction: number }> }> {
      public prefab!: Prefab<{ direction: number }>;
      public onCreate(): void {
        bulletId = this.instantiate(this.prefab, { direction: 3 }).id;
      }
    }
    registerScriptMetadata(Shooter, {
      exposed: { prefab: ScriptMetadata.field({ required: true }) },
    });

    const e: Entity = h.world.createEntity();
    h.scripts.attach(e, Shooter, { prefab: bulletPrefab });
    h.frame();

    expect(bulletId).toBeDefined();
    expect(h.scripts.getScript(bulletId!, Bullet)?.direction).toBe(3);
  });
});
```

- [ ] **Step 3: Lancer le test — vérifier le succès**

Run: `pnpm --filter @atlasjs/gameplay test prefab-exposed-prop`
Expected: PASS (1 test). Prouve : `Prefab` traverse `injectProps` intact (prop `field`), `instantiate` depuis `onCreate`, params → build → props du script attaché.

- [ ] **Step 4: Suite complète + typecheck + build**

Run: `pnpm --filter @atlasjs/gameplay test`
Expected: toute la suite passe.
Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit`
Expected: aucune erreur.
Run: `pnpm --filter @atlasjs/gameplay build`
Expected: build tsdown OK (nécessaire pour que la sandbox Vite résolve `definePrefab`/`Prefab`/`Instantiator`).

- [ ] **Step 5: Formater + remettre pour revue**

Run: `pnpm format`
Message suggéré : `feat(gameplay): export prefab API + end-to-end integration test`

---

## Self-Review

**1. Couverture de la spec :**

| Section spec | Tâche |
| --- | --- |
| §3 `Prefab`/`definePrefab`/`EntityBuilder` | Task 1 (steps 2-3) |
| §4 `Instantiator.instantiate` + params typés + option `parent` + retour `GameEntity` | Task 1 (step 4) |
| §4 timing différé (`onCreate` au flush) | Task 1 (test « attaches scripts ») + Task 3 (test instantiate) |
| §5 `destroy` (sous-arbre scripts + `commands.destroy` récursif) + extension `ScriptResolver` | Task 2 |
| §4/§5 exposition script (`this.instantiate`/`this.destroy`) | Task 3 (steps 4-6) |
| §7 câblage (`prefab/`, `INSTANTIATOR`, résolution paresseuse, casse-cycle) | Task 3 (steps 3, 7) |
| §6 prefab en prop exposé + assets par closure (factory app) | Task 4 (step 2, test bout-en-bout) |
| §7 barrel/exports publics | Task 4 (step 1) |

**2. Placeholders :** aucun `TBD`/`TODO` ; tous les steps de code contiennent le code réel.

**3. Cohérence des types :** `AttachArgs<T>` (défini Task 1 step 1) réutilisé par `EntityBuilder.attach` et `ScriptManager.attach`. `InstantiateArgs<TParams>`/`Prefab<TParams>` (Task 1 step 4/2) réutilisés à l'identique par `ScriptContext`/`AtlasScript`/`RuntimeScriptContext` (Task 3). `destroyEntityScripts` : déclaré sur `ScriptResolver` (Task 2 step 3), implémenté sur `ScriptManager` (Task 2 step 4), appelé par `GameEntityHandle.destroySubtreeScripts` (Task 2 step 3). `INSTANTIATOR` : défini Task 3 step 3, consommé Task 3 steps 6-7.

**4. Ambiguïté :** `InstantiateArgs<TParams>` rend `params` optionnel ssi `TParams` est `void` (`[TParams] extends [void]` en tuple pour éviter la distribution). Les auteurs annotent `definePrefab<Params>(…)` explicitement quand il y a des params (comme dans les tests).
