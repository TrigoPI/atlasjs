# B1 — Couche token `defineScriptComponent` — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le modèle façade-classe/alias de Phase A par un primitif token unique `defineScriptComponent(engine, create?)`, collapser le dispatch runtime en un seul chemin (brand), et migrer `Transform` de classe vers token — sans changer le comportement observable.

**Architecture:** `defineScriptComponent` sans factory renvoie le composant moteur par **identité** (passthrough, génériques préservés) ; avec factory renvoie un **token brandé** `{ [BRAND], engine, create }` dont `create(world, entity)` mint un proxy apatride. Le runtime dispatch sur `isScriptComponentToken(type)` (un seul point) au lieu de `type.prototype instanceof ScriptComponent`. `Transform` devient le seul token comportemental ; sa classe `ScriptComponent` et `ScriptComponentCtor` sont supprimées.

**Tech Stack:** TypeScript (strict, typage explicite obligatoire), `@atlasjs/nexus` (ECS), Vitest, pnpm/Turborepo. Package : `packages/gameplay`.

## Global Constraints

- **Typage explicite partout** — chaque variable, paramètre, retour typé, même trivial (règle CLAUDE.md racine).
- **Aucun commentaire** dans le code (règle CLAUDE.md racine).
- **Typecheck via `tsc --noEmit`**, jamais `tsc -b` dans `packages/gameplay` (émet des artefacts à côté des sources).
- **Tests** : `pnpm --filter @atlasjs/gameplay test` (vitest).
- **Cadence (mémoire utilisateur)** : sous-agents, une tâche à la fois. **L'auteur commite chaque étape lui-même** — chaque tâche se termine par un `git add` + un message de commit proposé, PAS de `git commit` automatique. Avant de démarrer une tâche, vérifier que la tâche précédente est verte **contre le HEAD commité** (l'auteur peut avoir édité au moment du commit) : re-lancer les tests sur l'état commité, ne pas se fier au diff relu.
- **Ne pas modifier `apps/sandbox`** : l'API `Transform` et les noms passthrough restent identiques → zéro changement de code attendu côté sandbox (Task 4 le vérifie).

---

## File Structure

**Créés :**
- `packages/gameplay/src/scripting/core/ScriptComponentToken.ts` — le primitif : `defineScriptComponent`, `ScriptComponentToken`, `isScriptComponentToken`.
- `packages/gameplay/test/script-component-token.test.ts` — tests unitaires du primitif.
- `packages/gameplay/test/script-passthrough-tokens.test.ts` — vérifie l'identité passthrough.

**Modifiés :**
- `packages/gameplay/src/scripting/components/Transform.ts` — classe → token (interface + factory + helpers libres).
- `packages/gameplay/src/scripting/components/index.ts` — exports `RigidBody`/`SpriteRenderer` via `defineScriptComponent`.
- `packages/gameplay/src/scripting/runtime/RuntimeScriptContext.ts` — dispatch brand.
- `packages/gameplay/src/scripting/core/AtlasScript.ts` — overloads token + `requireComponent`.
- `packages/gameplay/src/scripting/core/ScriptContext.ts` — overloads token.
- `packages/gameplay/src/scripting/core/index.ts` — retirer `ScriptComponent`, garder `ScriptComponentToken`.
- `packages/gameplay/test/script-components.test.ts`, `test/transform-parent-facade.test.ts`, `test/script-context-dispatch.test.ts`, `test/script-component-contract.test.ts` — migrations.
- `packages/gameplay/CLAUDE.md`, `docs/gameplay/scripting-component-unification.md`, `docs/backlog.md` — docs.

**Supprimés :**
- `packages/gameplay/src/scripting/core/ScriptComponent.ts` — classe abstraite `ScriptComponent` + `ScriptComponentCtor`.

---

## Task 1 : Le primitif `defineScriptComponent`

**Files:**
- Create: `packages/gameplay/src/scripting/core/ScriptComponentToken.ts`
- Modify: `packages/gameplay/src/scripting/core/index.ts`
- Test: `packages/gameplay/test/script-component-token.test.ts`

**Interfaces:**
- Produces:
  - `defineScriptComponent<TEngine, TArgs>(engine: Component<TEngine, TArgs>): Component<TEngine, TArgs>` (passthrough/identité)
  - `defineScriptComponent<TApi, TEngine, TArgs>(engine, create: (world: NexusWorld, entity: Entity) => TApi): ScriptComponentToken<TApi, TEngine, TArgs>` (comportemental)
  - `interface ScriptComponentToken<TApi, TEngine extends object, TArgs extends unknown[]> { readonly engine: Component<TEngine, TArgs>; create(world: NexusWorld, entity: Entity): TApi }` (+ un brand symbol interne)
  - `isScriptComponentToken(type: unknown): type is ScriptComponentToken<unknown, object, unknown[]>`

- [x] **Step 1 : Écrire le test qui échoue**

Create `packages/gameplay/test/script-component-token.test.ts` :

```ts
import { describe, expect, it } from "vitest";

import { NexusWorld, Entity } from "@atlasjs/nexus";

import { defineScriptComponent, isScriptComponentToken } from "../src/scripting";

class Foo {
  public value: number = 1;
}

describe("defineScriptComponent / ScriptComponentToken", () => {
  it("passthrough (no factory) returns the engine component by identity", () => {
    const token: typeof Foo = defineScriptComponent(Foo);

    expect(token).toBe(Foo);
    expect(isScriptComponentToken(token)).toBe(false);
  });

  it("behavioral (with factory) returns a branded token carrying the engine", () => {
    const token = defineScriptComponent(Foo, () => ({ tag: "api" as const }));

    expect(isScriptComponentToken(token)).toBe(true);
    expect(token.engine).toBe(Foo);
  });

  it("create() mints a fresh stateless proxy per call", () => {
    const world: NexusWorld = new NexusWorld();
    const entity: Entity = world.createEntity();
    let calls: number = 0;

    const token = defineScriptComponent(Foo, (w: NexusWorld, e: Entity) => {
      calls++;
      return { world: w, entity: e };
    });

    const a = token.create(world, entity);
    const b = token.create(world, entity);

    expect(calls).toBe(2);
    expect(a).not.toBe(b);
    expect(a.entity).toBe(entity);
  });

  it("isScriptComponentToken rejects plain components and arbitrary objects", () => {
    expect(isScriptComponentToken(Foo)).toBe(false);
    expect(isScriptComponentToken({})).toBe(false);
    expect(isScriptComponentToken({ engine: Foo })).toBe(false);
    expect(isScriptComponentToken(null)).toBe(false);
  });
});
```

- [x] **Step 2 : Lancer le test, vérifier l'échec**

Run: `pnpm --filter @atlasjs/gameplay test script-component-token`
Expected: FAIL — `defineScriptComponent`/`isScriptComponentToken` n'existent pas (import non résolu).

- [x] **Step 3 : Implémenter le primitif**

Create `packages/gameplay/src/scripting/core/ScriptComponentToken.ts` :

```ts
import { Component, Entity, NexusWorld } from "@atlasjs/nexus";

const BRAND: unique symbol = Symbol("ScriptComponentToken");

export interface ScriptComponentToken<
  TApi,
  TEngine extends object,
  TArgs extends unknown[],
> {
  readonly [BRAND]: true;
  readonly engine: Component<TEngine, TArgs>;
  create(world: NexusWorld, entity: Entity): TApi;
}

export function defineScriptComponent<
  TEngine extends object,
  TArgs extends unknown[],
>(engine: Component<TEngine, TArgs>): Component<TEngine, TArgs>;
export function defineScriptComponent<
  TApi,
  TEngine extends object,
  TArgs extends unknown[],
>(
  engine: Component<TEngine, TArgs>,
  create: (world: NexusWorld, entity: Entity) => TApi,
): ScriptComponentToken<TApi, TEngine, TArgs>;
export function defineScriptComponent<
  TApi,
  TEngine extends object,
  TArgs extends unknown[],
>(
  engine: Component<TEngine, TArgs>,
  create?: (world: NexusWorld, entity: Entity) => TApi,
): Component<TEngine, TArgs> | ScriptComponentToken<TApi, TEngine, TArgs> {
  if (create === undefined) {
    return engine;
  }

  return { [BRAND]: true, engine, create };
}

export function isScriptComponentToken(
  type: unknown,
): type is ScriptComponentToken<unknown, object, unknown[]> {
  return typeof type === "object" && type !== null && BRAND in type;
}
```

- [x] **Step 4 : Exporter depuis le barrel `core`**

Modify `packages/gameplay/src/scripting/core/index.ts` — ajouter la ligne (garder toutes les autres) :

```ts
export * from "./ScriptComponentToken";
```

- [x] **Step 5 : Lancer le test, vérifier le succès**

Run: `pnpm --filter @atlasjs/gameplay test script-component-token`
Expected: PASS (4 tests verts).

- [x] **Step 6 : Typecheck**

Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit`
Expected: aucun message d'erreur.

- [x] **Step 7 : Stage + handoff commit**

```bash
git add packages/gameplay/src/scripting/core/ScriptComponentToken.ts \
        packages/gameplay/src/scripting/core/index.ts \
        packages/gameplay/test/script-component-token.test.ts
```
Message de commit proposé (l'auteur commite) :
`feat(gameplay): add defineScriptComponent token primitive`

---

## Task 2 : Migrer `Transform` vers un token + collapse du dispatch

> **Refactor coordonné préservant le comportement.** Les éditions ci-dessous ne compilent pas isolément (suppression de `ScriptComponent` + retypage simultanés) : la porte de vérification (typecheck + suite complète) est **à la fin**. Les tests comportementaux existants de `Transform` (autorité dynamic/kinematic, statelessness, parenting) sont le filet de sécurité.

**Files:**
- Modify: `packages/gameplay/src/scripting/components/Transform.ts` (réécriture complète)
- Modify: `packages/gameplay/src/scripting/runtime/RuntimeScriptContext.ts` (réécriture complète)
- Modify: `packages/gameplay/src/scripting/core/AtlasScript.ts` (réécriture complète)
- Modify: `packages/gameplay/src/scripting/core/ScriptContext.ts` (réécriture complète)
- Modify: `packages/gameplay/src/scripting/core/index.ts` (retirer l'export `ScriptComponent`)
- Delete: `packages/gameplay/src/scripting/core/ScriptComponent.ts`
- Modify (tests): `packages/gameplay/test/script-components.test.ts`, `test/transform-parent-facade.test.ts`, `test/script-context-dispatch.test.ts`, `test/script-component-contract.test.ts`

**Interfaces:**
- Consumes (de Task 1) : `defineScriptComponent`, `ScriptComponentToken`, `isScriptComponentToken`.
- Produces :
  - `interface Transform { … }` (l'API script-facing) **et** `const Transform: ScriptComponentToken<Transform, Transform2D, []>` (le token) — même nom, espaces type + valeur.
  - `Transform.create(world, entity): Transform` (matérialisation d'un proxy).
  - `AtlasScript`/`ScriptContext`/`RuntimeScriptContext` : `addComponent`/`getComponent`/`requireComponent` overloadés `token → TApi` sinon `Component → TEngine` ; `hasComponent`/`removeComponent` acceptent l'union.

- [x] **Step 1 : Réécrire `Transform.ts` (classe → token)**

Remplacer **tout** le contenu de `packages/gameplay/src/scripting/components/Transform.ts` par :

```ts
import { Mat3, Vec2 } from "@atlasjs/math";
import { Entity, NexusWorld } from "@atlasjs/nexus";

import { defineScriptComponent } from "../core";

import {
  PhysicsBodyRef,
  RigidBody2D,
  Transform2D,
  WorldTransform2D,
} from "../../components";

const ENTITY: unique symbol = Symbol("Transform.entity");

export interface Transform {
  parent: Transform | null;
  position: Vec2;
  rotation: number;
  scale: Vec2;
  readonly worldPosition: Vec2;
  setPosition(x: number, y: number): Transform;
  setRotation(rotation: number): Transform;
  setScale(x: number, y: number): Transform;
  translate(dx: number, dy: number): Transform;
  rotate(angle: number): Transform;
  setParent(parent: Transform | null, worldPositionStays?: boolean): Transform;
  getChildren(): Transform[];
}

type TransformHandle = Transform & { readonly [ENTITY]: Entity };

function worldMatrix(world: NexusWorld, entity: Entity): Mat3 {
  const wt: WorldTransform2D | undefined = world.getComponent(
    entity,
    WorldTransform2D,
  );

  return wt !== undefined
    ? wt.matrix.clone()
    : Mat3.fromTransform2D(world.requireComponent(entity, Transform2D));
}

function controllingBody(
  world: NexusWorld,
  entity: Entity,
): PhysicsBodyRef | undefined {
  const rigidBody: RigidBody2D | undefined = world.getComponent(
    entity,
    RigidBody2D,
  );

  if (rigidBody === undefined || rigidBody.type !== "dynamic") {
    return undefined;
  }

  return world.getComponent(entity, PhysicsBodyRef);
}

function entityOf(transform: Transform): Entity {
  return (transform as TransformHandle)[ENTITY];
}

function createTransform(world: NexusWorld, entity: Entity): Transform {
  const api: TransformHandle = {
    [ENTITY]: entity,

    get parent(): Transform | null {
      const parentEntity: Entity | undefined = world.getParent(entity);
      return parentEntity !== undefined
        ? createTransform(world, parentEntity)
        : null;
    },

    get position(): Vec2 {
      return world.requireComponent(entity, Transform2D).position;
    },

    set position(value: Vec2) {
      this.setPosition(value.x, value.y);
    },

    get worldPosition(): Vec2 {
      return worldMatrix(world, entity).getTranslation();
    },

    get rotation(): number {
      return world.requireComponent(entity, Transform2D).rotation;
    },

    set rotation(value: number) {
      this.setRotation(value);
    },

    get scale(): Vec2 {
      return world.requireComponent(entity, Transform2D).scale;
    },

    set scale(value: Vec2) {
      this.setScale(value.x, value.y);
    },

    setPosition(x: number, y: number): Transform {
      world.requireComponent(entity, Transform2D).position.set(x, y);

      const body: PhysicsBodyRef | undefined = controllingBody(world, entity);
      if (body !== undefined) {
        body.body.setTranslation(x, y);
      }

      return this;
    },

    setRotation(rotation: number): Transform {
      world.requireComponent(entity, Transform2D).rotation = rotation;

      const body: PhysicsBodyRef | undefined = controllingBody(world, entity);
      if (body !== undefined) {
        body.body.setRotation(rotation);
      }

      return this;
    },

    setScale(x: number, y: number): Transform {
      world.requireComponent(entity, Transform2D).scale.set(x, y);
      return this;
    },

    translate(dx: number, dy: number): Transform {
      const position: Vec2 = world.requireComponent(
        entity,
        Transform2D,
      ).position;
      return this.setPosition(position.x + dx, position.y + dy);
    },

    rotate(angle: number): Transform {
      return this.setRotation(
        world.requireComponent(entity, Transform2D).rotation + angle,
      );
    },

    setParent(
      parent: Transform | null,
      worldPositionStays: boolean = true,
    ): Transform {
      if (!worldPositionStays) {
        world.setParent(entity, parent !== null ? entityOf(parent) : null);
        return this;
      }

      const currentWorld: Mat3 = worldMatrix(world, entity);

      world.setParent(entity, parent !== null ? entityOf(parent) : null);

      const parentWorld: Mat3 | null =
        parent !== null ? worldMatrix(world, entityOf(parent)) : null;

      const localMatrix: Mat3 =
        parentWorld !== null
          ? parentWorld.invert().multiply(currentWorld)
          : currentWorld;

      const transform: Transform2D = world.requireComponent(
        entity,
        Transform2D,
      );
      const position: Vec2 = localMatrix.getTranslation();
      const scale: Vec2 = localMatrix.getScale();

      transform.position.set(position.x, position.y);
      transform.rotation = localMatrix.getRotation();
      transform.scale.set(scale.x, scale.y);

      return this;
    },

    getChildren(): Transform[] {
      const children: ReadonlyArray<Entity> = world.getChildren(entity);
      const result: Transform[] = [];
      for (let i: number = 0; i < children.length; i++) {
        if (world.hasComponent(children[i], Transform2D)) {
          result.push(createTransform(world, children[i]));
        }
      }
      return result;
    },
  };

  return api;
}

export const Transform = defineScriptComponent(Transform2D, createTransform);
```

- [x] **Step 2 : Réécrire `RuntimeScriptContext.ts` (dispatch brand)**

Remplacer **tout** le contenu de `packages/gameplay/src/scripting/runtime/RuntimeScriptContext.ts` par :

```ts
import { ServiceRegistry } from "@atlasjs/core";
import { Component, Entity, NexusWorld } from "@atlasjs/nexus";

import {
  ScriptComponentToken,
  ScriptContext,
  ScriptServiceCtor,
  isScriptComponentToken,
} from "../core";

// prettier-ignore
export class RuntimeScriptContext implements ScriptContext {
  private readonly entity: Entity;
  private readonly world: NexusWorld;
  private readonly services: ServiceRegistry;

  public constructor(entity: Entity, world: NexusWorld, services: ServiceRegistry) {
    this.entity = entity;
    this.world = world;
    this.services = services;
  }

  public getEntityId(): Entity {
    return this.entity;
  }

  public getService<TFacade, TService>(
    type: ScriptServiceCtor<TFacade, TService>,
  ): TFacade {
    return new type(this.services);
  }

  public hasComponent(
    type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>,
  ): boolean {
    return this.world.hasComponent(
      this.entity,
      isScriptComponentToken(type) ? type.engine : type,
    );
  }

  public getComponent<TApi, TEngine extends object>(type: ScriptComponentToken<TApi, TEngine, any[]>): TApi | undefined;
  public getComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent | undefined;
  public getComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): unknown {
    if (isScriptComponentToken(type)) {
      if (!this.world.hasComponent(this.entity, type.engine)) {
        return undefined;
      }
      return type.create(this.world, this.entity);
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
    if (existing !== undefined) {
      return existing;
    }

    return this.world.addComponent(this.entity, type, ...args);
  }

  public removeComponent(
    type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>,
  ): void {
    this.world.removeComponent(
      this.entity,
      isScriptComponentToken(type) ? type.engine : type,
    );
  }
}
```

- [x] **Step 3 : Réécrire `ScriptContext.ts` (overloads token)**

Remplacer **tout** le contenu de `packages/gameplay/src/scripting/core/ScriptContext.ts` par :

```ts
import { Component, Entity } from "@atlasjs/nexus";

import { ScriptComponentToken } from "./ScriptComponentToken";
import { ScriptServiceCtor } from "./ScriptService";

export interface ScriptContext {
  getEntityId(): Entity;

  getService<TFacade, TService>(
    type: ScriptServiceCtor<TFacade, TService>,
  ): TFacade;

  hasComponent(
    type:
      | Component<object, any[]>
      | ScriptComponentToken<unknown, object, any[]>,
  ): boolean;

  getComponent<TApi, TEngine extends object>(
    type: ScriptComponentToken<TApi, TEngine, any[]>,
  ): TApi | undefined;
  getComponent<TComponent extends object>(
    type: Component<TComponent, any[]>,
  ): TComponent | undefined;

  addComponent<TApi, TEngine extends object, TArgs extends unknown[]>(
    type: ScriptComponentToken<TApi, TEngine, TArgs>,
    ...args: TArgs
  ): TApi;
  addComponent<TComponent extends object, TArgs extends unknown[]>(
    type: Component<TComponent, TArgs>,
    ...args: TArgs
  ): TComponent;

  removeComponent(
    type:
      | Component<object, any[]>
      | ScriptComponentToken<unknown, object, any[]>,
  ): void;
}
```

- [x] **Step 4 : Réécrire `AtlasScript.ts` (overloads token + `requireComponent`)**

Remplacer **tout** le contenu de `packages/gameplay/src/scripting/core/AtlasScript.ts` par :

```ts
import { Component, Entity } from "@atlasjs/nexus";

import {
  ScriptComponentToken,
  isScriptComponentToken,
} from "./ScriptComponentToken";
import { ScriptServiceCtor } from "./ScriptService";
import { ScriptContext } from "./ScriptContext";
import { ScriptLifecycle } from "./ScriptLifeCycle";

// prettier-ignore
export abstract class AtlasScript<TProps extends object = {}> implements ScriptLifecycle {
  declare public readonly __props?: TProps;

  private __context?: ScriptContext;

  public onCreate?(): void;
  public onUpdate?(dt: number): void;
  public onFixedUpdate?(): void;
  public onDestroy?(): void;

  public __bindContext(context: ScriptContext): void {
    this.__context = context;
  }

  public __unbindContext(): void {
    this.__context = undefined;
  }

  protected get context(): ScriptContext {
    if (!this.__context) {
      throw new Error(
        "[AtlasScript] Script context is not bound. This script is being used outside of the runtime.",
      );
    }

    return this.__context;
  }

  public get entityId(): Entity {
    return this.context.getEntityId();
  }

  public getService<TFacade, TService>(
    type: ScriptServiceCtor<TFacade, TService>,
  ): TFacade {
    return this.context.getService(type);
  }

  public hasComponent(
    type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>,
  ): boolean {
    return this.context.hasComponent(type);
  }

  public getComponent<TApi, TEngine extends object>(type: ScriptComponentToken<TApi, TEngine, any[]>): TApi | undefined;
  public getComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent | undefined;
  public getComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): unknown {
    return this.context.getComponent(type as Component<object, any[]>);
  }

  public addComponent<TApi, TEngine extends object, TArgs extends unknown[]>(type: ScriptComponentToken<TApi, TEngine, TArgs>, ...args: TArgs): TApi;
  public addComponent<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs>, ...args: TArgs): TComponent;
  public addComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>, ...args: any[]): unknown {
    return this.context.addComponent(type as Component<object, any[]>, ...args);
  }

  public removeComponent(
    type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>,
  ): void {
    this.context.removeComponent(type);
  }

  public requireComponent<TApi, TEngine extends object>(type: ScriptComponentToken<TApi, TEngine, any[]>): TApi;
  public requireComponent<TComponent extends object>(type: Component<TComponent, any[]>): TComponent;
  public requireComponent(type: Component<object, any[]> | ScriptComponentToken<unknown, object, any[]>): unknown {
    const component: unknown = this.getComponent(type as Component<object, any[]>);

    if (component === undefined) {
      const name: string = isScriptComponentToken(type) ? type.engine.name : type.name;
      throw new Error(
        `[AtlasScript] Required component "${name}" is missing on entity "${this.entityId}".`,
      );
    }

    return component;
  }
}
```

- [x] **Step 5 : Retirer l'export `ScriptComponent` du barrel `core`**

Modify `packages/gameplay/src/scripting/core/index.ts` — supprimer la ligne `export * from "./ScriptComponent";`. Résultat attendu :

```ts
export * from "./AtlasScript";
export * from "./ScriptContext";
export * from "./ScriptComponentToken";
export * from "./ScriptService";
export * from "./ScriptLifeCycle";
export * from "./core-types";
export * from "./ScriptMetadata";
```

- [x] **Step 6 : Supprimer `ScriptComponent.ts`**

```bash
git rm packages/gameplay/src/scripting/core/ScriptComponent.ts
```

- [x] **Step 7 : Migrer `script-components.test.ts`**

Dans `packages/gameplay/test/script-components.test.ts`, remplacer chaque `new Transform(...)` par `Transform.create(...)`. Il y a 7 occurrences ; le résultat de chacune :
- `new Transform(h.world, e).setPosition(3, 4).setScale(2, 2);` → `Transform.create(h.world, e).setPosition(3, 4).setScale(2, 2);`
- `const transform: Transform = new Transform(h.world, e);` → `const transform: Transform = Transform.create(h.world, e);` (les 3 occurrences)
- `new Transform(h.world, e).setPosition(5, 0);` → `Transform.create(h.world, e).setPosition(5, 0);`
- `new Transform(h.world, e).setPosition(50, 0);` → `Transform.create(h.world, e).setPosition(50, 0);`
- `new Transform(h.world, e).position.x = 50;` → `Transform.create(h.world, e).position.x = 50;`

L'import `import { Transform } from "../src/scripting";` reste inchangé (le type `Transform` et le token `Transform` partagent le nom).

- [x] **Step 8 : Migrer `transform-parent-facade.test.ts`**

Dans `packages/gameplay/test/transform-parent-facade.test.ts`, remplacer les 8 `new Transform(world, ...)` par `Transform.create(world, ...)` (ex. `const child: Transform = new Transform(world, childE);` → `const child: Transform = Transform.create(world, childE);`). Import inchangé.

- [x] **Step 9 : Migrer `script-context-dispatch.test.ts`**

Dans `packages/gameplay/test/script-context-dispatch.test.ts`, une seule assertion casse (`toBeInstanceOf(Transform)` — un token n'est pas une classe). Remplacer, dans le test `"addComponent(façade) adds the backing engine component and proxies it"` :

```ts
    expect(probe.transform).toBeInstanceOf(Transform);
```
par :
```ts
    expect(typeof probe.transform.setPosition).toBe("function");
    expect(probe.transform.position.x).toBe(11);
```

Tout le reste du fichier (annotations `: Transform`, `Transform | undefined`, imports `RigidBody`/`Transform`) reste inchangé.

- [x] **Step 10 : Migrer `script-component-contract.test.ts`**

Le mode d'échec « façade oublie `static engine` » disparaît (plus de classe `ScriptComponent`). Remplacer **tout** le contenu de `packages/gameplay/test/script-component-contract.test.ts` par (on conserve et reformule le cas anti-mal-classement du `Decoy`) :

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { Transform2D } from "../src/components";
import { AtlasScript } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class Decoy {
  public static readonly engine = Transform2D;
  public value: number = 7;
}

class DecoyProbe extends AtlasScript {
  public decoy!: Decoy;

  public onCreate(): void {
    this.decoy = this.addComponent(Decoy);
  }
}

describe("Gameplay — script component dispatch (brand, not `static engine`)", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("treats a raw component with a `static engine` as raw (dispatch keys on the brand)", () => {
    const e: Entity = h.world.createEntity();
    const probe: DecoyProbe = h.scripts.attach(e, DecoyProbe);

    h.frame();

    expect(probe.decoy).toBeInstanceOf(Decoy);
    expect(probe.decoy.value).toBe(7);
    expect(h.world.hasComponent(e, Decoy)).toBe(true);
    expect(h.world.hasComponent(e, Transform2D)).toBe(false);
  });
});
```

- [x] **Step 11 : Typecheck**

Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit`
Expected: aucune erreur. (Si erreur « `Transform` only refers to a type but is being used as a value » ou similaire dans un test → une occurrence `new Transform` a été oubliée en Step 7/8.)

- [x] **Step 12 : Lancer la suite complète**

Run: `pnpm --filter @atlasjs/gameplay test`
Expected: PASS intégral. En particulier verts :
- `script-components.test.ts` — autorité dynamic (téléport survit), kinematic, statelessness, throw si absent.
- `transform-parent-facade.test.ts` — `setParent`, `worldPositionStays`, `parent`/`getChildren`.
- `script-context-dispatch.test.ts` — add/get/has/remove `Transform`, args forwarding raw.
- `script-component-contract.test.ts` — `Decoy` reste raw.

- [x] **Step 13 : Stage + handoff commit**

```bash
git add packages/gameplay/src/scripting/ packages/gameplay/test/
```
Message de commit proposé :
`refactor(gameplay): migrate Transform façade to a script-component token, collapse dispatch`

---

## Task 3 : Passthrough uniformes (`RigidBody`/`SpriteRenderer`)

**Files:**
- Modify: `packages/gameplay/src/scripting/components/index.ts`
- Test: `packages/gameplay/test/script-passthrough-tokens.test.ts` (créé)

**Interfaces:**
- Consumes : `defineScriptComponent` (Task 1), `RigidBody2D`/`SpriteRender` (`../../components`).
- Produces : `const RigidBody` (= `RigidBody2D` par identité) + `type RigidBody = RigidBody2D` ; `const SpriteRenderer` (= `SpriteRender`) + `type SpriteRenderer = SpriteRender`.

- [x] **Step 1 : Écrire le test qui échoue**

Create `packages/gameplay/test/script-passthrough-tokens.test.ts` :

```ts
import { describe, expect, it } from "vitest";

import { RigidBody2D, SpriteRender } from "../src/components";
import { RigidBody, SpriteRenderer, isScriptComponentToken } from "../src/scripting";

describe("Gameplay — passthrough script components (identity)", () => {
  it("RigidBody is the raw RigidBody2D component (identity, not a token)", () => {
    expect(RigidBody).toBe(RigidBody2D);
    expect(isScriptComponentToken(RigidBody)).toBe(false);
  });

  it("SpriteRenderer is the raw SpriteRender component (identity, not a token)", () => {
    expect(SpriteRenderer).toBe(SpriteRender);
    expect(isScriptComponentToken(SpriteRenderer)).toBe(false);
  });
});
```

- [x] **Step 2 : Lancer, vérifier l'état**

Run: `pnpm --filter @atlasjs/gameplay test script-passthrough-tokens`
Expected : les deux `toBe` PASSENT déjà (l'alias Phase A `export { RigidBody2D as RigidBody }` est aussi une identité), mais l'objectif est de router l'export via `defineScriptComponent` pour uniformiser. (Si le test passe déjà, il verrouille l'invariant ; on procède au Step 3 pour la forme uniforme.)

- [x] **Step 3 : Router les exports via `defineScriptComponent`**

Remplacer **tout** le contenu de `packages/gameplay/src/scripting/components/index.ts` par :

```ts
import { RigidBody2D, SpriteRender } from "../../components";
import { defineScriptComponent } from "../core";

export const RigidBody = defineScriptComponent(RigidBody2D);
export type RigidBody = RigidBody2D;

export const SpriteRenderer = defineScriptComponent(SpriteRender);
export type SpriteRenderer = SpriteRender;

export * from "./Transform";
```

- [x] **Step 4 : Lancer le test, vérifier le succès**

Run: `pnpm --filter @atlasjs/gameplay test script-passthrough-tokens`
Expected: PASS (2 tests). `defineScriptComponent(RigidBody2D)` renvoie `RigidBody2D` par identité → `RigidBody === RigidBody2D`.

- [x] **Step 5 : Typecheck + suite complète**

Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit && pnpm --filter @atlasjs/gameplay test`
Expected: aucun message d'erreur ; suite intégralement verte (notamment `script-context-dispatch.test.ts` qui importe `RigidBody`).

- [x] **Step 6 : Stage + handoff commit**

```bash
git add packages/gameplay/src/scripting/components/index.ts \
        packages/gameplay/test/script-passthrough-tokens.test.ts
```
Message de commit proposé :
`refactor(gameplay): mint RigidBody/SpriteRenderer via defineScriptComponent (passthrough)`

---

## Task 4 : Vérification sandbox + build (aucun changement de code)

> But : prouver la **parité comportementale** — l'API `Transform` et les noms passthrough sont identiques, donc `apps/sandbox` compile et tourne sans modification.

**Files:** aucun (vérification seule).

- [x] **Step 1 : Rebuild `@atlasjs/gameplay` (dist consommée par la preview vite du sandbox)**

Run: `pnpm --filter @atlasjs/gameplay build`
Expected: build OK (tsdown → `dist`).

- [x] **Step 2 : Typecheck du sandbox**

Run: `pnpm --filter sandbox exec tsc --noEmit`
Expected: aucune erreur. `TestScript`/`WallScript`/`SwordScript` utilisent `Transform`/`RigidBody`/`SpriteRenderer`/`Animator`/`PlayerInput` — tous inchangés en surface. Si erreur → une régression de surface d'API a été introduite (revenir sur Task 2/3).

- [x] **Step 3 : Lancer la preview sandbox**

Démarrer le serveur dev via l'outil preview (config `sandbox` de `.claude/launch.json`, port 5173) : `preview_start({ name: "sandbox" })`.

- [x] **Step 4 : Vérifier l'absence d'erreurs runtime**

Via les outils preview : `read_console_messages({ onlyErrors: true })` puis `preview_logs({ level: "error" })`.
Expected: aucune erreur console/serveur.

- [x] **Step 5 : Validation visuelle (parité)**

Confirmer via screenshot/interaction :
- le dino (`TestScript`) bouge au clavier (WASD/flèches selon `controls`) et flippe selon la direction ;
- l'épée (`SwordScript`) suit la souris (rotation vers le curseur) ;
- le mur (`WallScript`) est statique, teinté vert semi-transparent.

Expected: comportement **identique** à avant B1.

- [x] **Step 6 : (aucun commit)** — tâche de vérification pure. Si tout est vert, passer à Task 5. Sinon, corriger la tâche fautive.

---

## Task 5 : Documentation

**Files:**
- Modify: `packages/gameplay/CLAUDE.md`
- Modify: `docs/gameplay/scripting-component-unification.md`
- Modify: `docs/backlog.md`

- [ ] **Step 1 : Réécrire la section « The two component levels » de `packages/gameplay/CLAUDE.md`**

Remplacer la description « façade = `ScriptComponent` subclass » par le modèle token. Points à refléter :
- `scripting/components/` ne contient plus de classe façade : tous les composants de script sont mintés par `defineScriptComponent(engine, create?)`.
- `defineScriptComponent(engine)` sans `create` = **identité** (passthrough) → renvoie le composant moteur brut, génériques préservés (`PlayerInput<T>`).
- `defineScriptComponent(engine, create)` = token comportemental → `create(world, entity)` mint un proxy apatride. **Un seul** aujourd'hui : `Transform` (autorité + hiérarchie + world-matrix).
- `RigidBody`/`SpriteRenderer` : `defineScriptComponent(RigidBody2D)`/`(SpriteRender)` (identité). `Animator`/`PlayerInput` : exports bruts (nom script == nom moteur).
- Conserver la note **péremption raw vs proxy** (inchangée).

Remplacer aussi la sous-section « ## Façade & service dispatch » : le dispatch se fait sur `isScriptComponentToken(type)` (brand), plus sur `prototype instanceof ScriptComponent`. Un token comportemental → opère sur `type.engine`, renvoie `type.create(world, entity)` ; sinon → composant Nexus brut.

Dans « ## Invariants — do not break », remplacer « extends `ScriptComponent`, `static engine` » par « minté via `defineScriptComponent` avec une factory ; réserver aux vraies logiques d'autorité/hiérarchie/état-dérivé ». Retirer les mentions de la classe `ScriptComponent`/`static engine` (n'existent plus).

Dans « ## Layout », mettre à jour : `scripting/core/` liste `ScriptComponentToken` (`defineScriptComponent`/`isScriptComponentToken`) au lieu de `ScriptComponent` (+ `ScriptComponentCtor`).

- [ ] **Step 2 : Marquer B1 fait dans `docs/gameplay/scripting-component-unification.md`**

En tête de la §5.1 (`### 5.1 B1 — Couche scripting-component uniforme`), ajouter une ligne de statut :

```markdown
> **Statut : ✅ implémenté.** Plan : [`scripting-component-token-b1-plan.md`](scripting-component-token-b1-plan.md) ; spec : [`scripting-component-token-b1.md`](scripting-component-token-b1.md).
```

- [ ] **Step 3 : Basculer B1 en fait dans `docs/backlog.md`**

Dans la section « Gameplay — Modèle de composants de script (unification — Phase B) », remplacer la puce B1 `📋` par une puce ✅ (déplacer l'item hors des `📋` à faire, en gardant B2/B3 `📋`). Texte proposé :

```markdown
- ✅ **B1 — Couche token `defineScriptComponent(engine, create?)`** : vocabulaire uniforme, dispatch collapsé sur un brand, `Transform` migré de classe façade vers token, passthrough = identité (génériques `PlayerInput<T>` préservés). Spec : [`gameplay/scripting-component-token-b1.md`](gameplay/scripting-component-token-b1.md).
```

- [ ] **Step 4 : Vérif finale**

Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit && pnpm --filter @atlasjs/gameplay test`
Expected: vert (les docs ne touchent pas le code, mais on re-confirme l'état).

- [ ] **Step 5 : Stage + handoff commit**

```bash
git add packages/gameplay/CLAUDE.md \
        docs/gameplay/scripting-component-unification.md \
        docs/backlog.md
```
Message de commit proposé :
`docs(gameplay): document defineScriptComponent token model (B1)`

---

## Self-Review

**Spec coverage** (spec §3–§12 → tâches) :
- §3 primitif → Task 1. ✅
- §4 `Transform` token → Task 2 (Step 1). ✅
- §5 passthrough → Task 3. ✅
- §6 collapse dispatch → Task 2 (Step 2). ✅
- §7 typage overloads → Task 2 (Steps 3–4). ✅
- §8 suppressions (`ScriptComponent`/`ScriptComponentCtor`) → Task 2 (Steps 5–6). ✅
- §9 migration tests (4 fichiers) → Task 2 (Steps 7–10). ✅
- §10 docs → Task 5. ✅
- §11 ordre + vérif sandbox/preview → Tasks 4 & 5. ✅
- §12 hors périmètre (fluent, B2, B3) → non implémenté (correct). ✅

**Placeholder scan** : aucun TBD/TODO ; tout le code des steps est complet.

**Type consistency** : `defineScriptComponent`/`ScriptComponentToken`/`isScriptComponentToken` (Task 1) réutilisés à l'identique en Tasks 2–3. `Transform.create(world, entity)` (Task 2 Step 1) appelé tel quel dans les tests migrés (Steps 7–8) et cohérent avec l'interface `ScriptComponentToken.create`. Overloads `token → TApi` / `Component → TEngine` identiques dans `ScriptContext`, `AtlasScript`, `RuntimeScriptContext`. `entityOf`/`ENTITY`/`TransformHandle` définis et utilisés dans le seul `Transform.ts`.

**Point de vigilance connu** : le seul point subtil est le threading de l'`entity` entre proxies `Transform` via le symbole `ENTITY` (nécessaire car `setParent(parent)` lit l'entity du parent, et le proxy n'est plus une classe portant `this.entity`). Couvert par `transform-parent-facade.test.ts` (Task 2 Step 12).
