# Prefab multi-entités (enfants inline + orbite) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter au moteur un primitive `EntityBuilder.child(buildFn)` pour construire des prefabs multi-entités avec références internes, et l'utiliser dans `dino-brawl` pour un prefab `SwordWithShadow` (racine → épée + ombre) dont on instancie N exemplaires en orbite autour d'une ancre.

**Architecture:** Le primitive `child()` crée l'entité enfant **synchronement** pendant `build`, la parente à la racine, et retourne son `EntityBuilder` — donc `.entity` est disponible immédiatement pour câbler un frère (aucun remap). La racine d'un groupe porte un `Transform2D` **identité** (requis par `TransformPropagationSystem`, qui ne propage que depuis `Transform2D.without(Parent)`) et reste **top-level** ; les enfants se positionnent en coords monde absolues via leurs scripts. L'orbite est une fonction pure `orbitBase()` partagée par les scripts épée/ombre.

**Tech Stack:** TypeScript, monorepo pnpm/Turborepo, `@atlasjs/gameplay` (ECS Nexus + scripting), `@atlasjs/math` (`Vec2`), vitest (moteur + app), Vite (preview dino-brawl).

**Spec de référence :** [`prefab-multi-entity.md`](prefab-multi-entity.md).

## Global Constraints

- **Toujours typer** : paramètres de fonction, variables, champs de classe — même trivialement (règle repo).
- **Aucun commentaire** ajouté dans le code (règle repo).
- **Vite / imports type-only** : dans les fichiers app (`apps/dino-brawl/**`), tout symbole utilisé uniquement comme type doit être importé avec `import type` — sinon `tsc` passe mais Vite casse au runtime (écran noir). Suivre exactement les patterns d'import des fichiers voisins existants.
- **Rebuild du dist après changement d'API publique** : après avoir modifié l'API publique de `@atlasjs/gameplay`, lancer `pnpm --filter @atlasjs/gameplay build` **avant** tout typecheck ou preview de l'app (l'app résout `@atlasjs/gameplay` via son `dist`).
- **Prettier avant staging** : le repo a un `.prettierrc`. Formater les `.ts` touchés avec `npx prettier --write <paths>` (scopé aux fichiers touchés, **jamais** repo-wide) avant de stager. **Ne pas** reformater les `docs/*.md` (édition sémantique seulement).
- **Pas de commit automatique** : à la fin de chaque tâche, formater + stager, puis **laisser l'utilisateur relire et committer** (le message de commit est fourni à titre de suggestion).
- **Racine de groupe** : un prefab-racine multi-entités a un `Transform2D` identité et reste **top-level** — ne jamais la parenter sous une entité qui a un transform (double-transform + héritage de scale).

---

### Task 1: Primitive moteur `EntityBuilder.child()`

**Files:**
- Modify: `packages/gameplay/src/prefab/EntityBuilder.ts`
- Test: `packages/gameplay/test/prefab-child.test.ts` (create)

**Interfaces:**
- Consumes : `NexusWorld.createEntity()`, `NexusWorld.setParent(child, parent)`, `ScriptManager` (déjà reçus au ctor de `PrefabEntityBuilder`).
- Produces : `EntityBuilder.child(build: (entity: EntityBuilder) => void): EntityBuilder` — crée l'enfant, le parente à `this.entity`, retourne le `EntityBuilder` de l'enfant (dont `.entity` est l'`Entity` fraîche). Disponible sur l'interface `EntityBuilder` (profondeur arbitraire).

- [ ] **Step 1: Écrire le fichier de tests (échoue à la compilation : `child` n'existe pas)**

Créer `packages/gameplay/test/prefab-child.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import { Transform2D } from "../src";
import { AtlasScript } from "../src/scripting";
import { definePrefab, Instantiator } from "../src/prefab";
import { createHarness, Harness } from "./helpers/harness";

describe("EntityBuilder.child", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("creates a child parented to the root", () => {
    const prefab = definePrefab({
      build(entity): void {
        entity.add(Transform2D);
        entity.child((c) => {
          c.add(Transform2D);
        });
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);
    const root: Entity = inst.instantiate(prefab).id;
    const children: ReadonlyArray<Entity> = h.world.getChildren(root);

    expect(children.length).toBe(1);
    expect(h.world.getParent(children[0])).toBe(root);
  });

  it("returns a handle whose .entity is usable to wire a sibling", () => {
    let firstChild: Entity | null = null;
    let capturedInSecond: Entity | null = null;

    const prefab = definePrefab({
      build(entity): void {
        entity.add(Transform2D);
        const a = entity.child((c) => {
          c.add(Transform2D);
        });
        firstChild = a.entity;
        entity.child((c) => {
          c.add(Transform2D);
          capturedInSecond = a.entity;
        });
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);
    inst.instantiate(prefab);

    expect(firstChild).not.toBeNull();
    expect(capturedInSecond).toBe(firstChild);
    expect(h.world.exists(firstChild!)).toBe(true);
  });

  it("supports nested children (arbitrary depth)", () => {
    const prefab = definePrefab({
      build(entity): void {
        entity.add(Transform2D);
        entity.child((c) => {
          c.add(Transform2D);
          c.child((g) => {
            g.add(Transform2D);
          });
        });
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);
    const root: Entity = inst.instantiate(prefab).id;
    const child: Entity = h.world.getChildren(root)[0];
    const grandchild: Entity = h.world.getChildren(child)[0];

    expect(h.world.getParent(child)).toBe(root);
    expect(h.world.getParent(grandchild)).toBe(child);
  });

  it("destroy on the root removes children and fires their onDestroy", () => {
    let childDestroyed: boolean = false;
    class Dying extends AtlasScript {
      public onDestroy(): void {
        childDestroyed = true;
      }
    }

    const prefab = definePrefab({
      build(entity): void {
        entity.add(Transform2D);
        entity.child((c) => {
          c.add(Transform2D);
          c.attach(Dying);
        });
      },
    });

    const inst: Instantiator = new Instantiator(h.world, h.scripts);
    const gameEntity = inst.instantiate(prefab);
    const root: Entity = gameEntity.id;
    const child: Entity = h.world.getChildren(root)[0];
    h.frame();

    gameEntity.destroy();
    h.frame();

    expect(childDestroyed).toBe(true);
    expect(h.world.exists(child)).toBe(false);
    expect(h.world.exists(root)).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `pnpm --filter @atlasjs/gameplay test prefab-child`
Expected: FAIL — erreur TypeScript « Property 'child' does not exist on type 'EntityBuilder' ».

- [ ] **Step 3: Implémenter `child()` dans `EntityBuilder.ts`**

Remplacer le contenu de `packages/gameplay/src/prefab/EntityBuilder.ts` par :

```ts
import { Component, Entity, NexusWorld } from "@atlasjs/nexus";

import { createGameEntity } from "../scripting/core";
import type { AttachArgs, ScriptManager } from "../scripting/runtime";

import type {
  AtlasScript,
  GameEntity,
  ScriptComponentToken,
  ScriptConstructor,
} from "../scripting/core";

// prettier-ignore
export interface EntityBuilder {
  readonly entity: Entity;
  add<TApi, TEngine extends object, TArgs extends unknown[]>(type: ScriptComponentToken<TApi, TEngine, TArgs>, ...args: TArgs): TApi;
  add<TComponent extends object, TArgs extends unknown[]>(type: Component<TComponent, TArgs>, ...args: TArgs): TComponent;
  attach<TScript extends AtlasScript>(Script: ScriptConstructor<TScript>, ...rest: AttachArgs<TScript>): TScript;
  child(build: (entity: EntityBuilder) => void): EntityBuilder;
}

// prettier-ignore
export class PrefabEntityBuilder implements EntityBuilder {
  public readonly entity: Entity;
  private readonly self: GameEntity;
  private readonly world: NexusWorld;
  private readonly scripts: ScriptManager;

  public constructor(entity: Entity, world: NexusWorld, scripts: ScriptManager) {
    this.entity = entity;
    this.self = createGameEntity(entity, world, scripts);
    this.world = world;
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

  public child(build: (entity: EntityBuilder) => void): EntityBuilder {
    const childEntity: Entity = this.world.createEntity();
    const childBuilder: PrefabEntityBuilder = new PrefabEntityBuilder(childEntity, this.world, this.scripts);
    build(childBuilder);
    this.world.setParent(childEntity, this.entity);
    return childBuilder;
  }
}
```

Changements : import `NexusWorld` (déjà présent), ajout du champ `private readonly world` + son affectation au ctor, `child()` sur l'interface et la classe.

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `pnpm --filter @atlasjs/gameplay test prefab-child`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck du package**

Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 6: Rebuild du dist (l'app en dépend aux tâches suivantes)**

Run: `pnpm --filter @atlasjs/gameplay build`
Expected: build OK, `dist` régénéré avec `child()` dans les types.

- [ ] **Step 7: Formater, stager, remettre à l'utilisateur pour commit**

```bash
npx prettier --write packages/gameplay/src/prefab/EntityBuilder.ts packages/gameplay/test/prefab-child.test.ts
git add packages/gameplay/src/prefab/EntityBuilder.ts packages/gameplay/test/prefab-child.test.ts
# suggestion (l'utilisateur relit puis committe) :
# git commit -m "feat(gameplay): EntityBuilder.child() for multi-entity prefabs"
```

---

### Task 2: Helper d'orbite `orbitBase` (app, pur + testé)

**Files:**
- Create: `apps/dino-brawl/src/game/scripts/orbit.ts`
- Test: `apps/dino-brawl/src/game/scripts/orbit.test.ts` (create)

**Interfaces:**
- Consumes : `Vec2` (`@atlasjs/math`) — `Vec2.fromAngle(r)` (vecteur unité `(cos r, sin r)`), `.mult(k)`, `.add(v)`.
- Produces : `orbitBase(anchorWorld: Vec2, r: number, angle: number, angularSpeed: number, clock: number): Vec2` — retourne une **nouvelle** `Vec2` = `anchorWorld + polar(r, angle + angularSpeed·clock)`, sans muter `anchorWorld`.

- [ ] **Step 1: Écrire le test unitaire (échoue : `orbit.ts` n'existe pas)**

Créer `apps/dino-brawl/src/game/scripts/orbit.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { Vec2 } from "@atlasjs/math";

import { orbitBase } from "./orbit";

describe("orbitBase", () => {
  it("places the base at anchor + r along the initial angle", () => {
    const base: Vec2 = orbitBase(new Vec2(0, 0), 10, 0, 0, 0);
    expect(base.x).toBeCloseTo(10);
    expect(base.y).toBeCloseTo(0);
  });

  it("is relative to the anchor", () => {
    const base: Vec2 = orbitBase(new Vec2(5, 5), 10, 0, 0, 0);
    expect(base.x).toBeCloseTo(15);
    expect(base.y).toBeCloseTo(5);
  });

  it("advances the angle with angularSpeed over time", () => {
    const base: Vec2 = orbitBase(new Vec2(0, 0), 10, 0, Math.PI / 2, 1);
    expect(base.x).toBeCloseTo(0);
    expect(base.y).toBeCloseTo(10);
  });

  it("does not mutate the anchor vector", () => {
    const anchor: Vec2 = new Vec2(3, 7);
    orbitBase(anchor, 10, 1.2, 0.5, 2);
    expect(anchor.x).toBe(3);
    expect(anchor.y).toBe(7);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `pnpm --filter dino-brawl test orbit`
Expected: FAIL — module `./orbit` introuvable.

- [ ] **Step 3: Implémenter `orbit.ts`**

Créer `apps/dino-brawl/src/game/scripts/orbit.ts` :

```ts
import { Vec2 } from "@atlasjs/math";

export function orbitBase(
  anchorWorld: Vec2,
  r: number,
  angle: number,
  angularSpeed: number,
  clock: number,
): Vec2 {
  const theta: number = angle + angularSpeed * clock;
  return Vec2.fromAngle(theta).mult(r).add(anchorWorld);
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `pnpm --filter dino-brawl test orbit`
Expected: PASS (4 tests).

- [ ] **Step 5: Formater, stager, remettre à l'utilisateur pour commit**

```bash
npx prettier --write apps/dino-brawl/src/game/scripts/orbit.ts apps/dino-brawl/src/game/scripts/orbit.test.ts
git add apps/dino-brawl/src/game/scripts/orbit.ts apps/dino-brawl/src/game/scripts/orbit.test.ts
# suggestion :
# git commit -m "feat(dino-brawl): pure orbitBase helper for orbiting swords"
```

---

### Task 3: Réécrire `SwordScript` et `SwordShadowScript` pour l'orbite

**Files:**
- Modify: `apps/dino-brawl/src/game/scripts/SwordScript.ts`
- Modify: `apps/dino-brawl/src/game/scripts/SwordShadowScript.ts`

**Interfaces:**
- Consumes : `orbitBase` (Task 2), `Transform` façade (`.worldPosition`, `.position`, `.scale`), `GameEntity.requireComponent`.
- Produces :
  - `SwordScript` props `{ anchor: GameEntity; r: number; angle: number; angularSpeed: number }`.
  - `SwordShadowScript` props `{ anchor: GameEntity; sword: GameEntity; r: number; angle: number; angularSpeed: number; shadowOffset: Vec2; scale: Vec2 }`.

- [ ] **Step 1: Réécrire `SwordScript.ts`**

Remplacer tout le contenu de `apps/dino-brawl/src/game/scripts/SwordScript.ts` par :

```ts
import { Vec2 } from "@atlasjs/math";

import {
  AtlasScript,
  registerScriptMetadata,
  ScriptMetadata,
  Transform,
  type GameEntity,
} from "@atlasjs/gameplay";

import { orbitBase } from "./orbit";

type SwordScriptProps = {
  anchor: GameEntity;
  r: number;
  angle: number;
  angularSpeed: number;
};

export class SwordScript extends AtlasScript<SwordScriptProps> {
  private readonly anchor: GameEntity;
  private readonly r: number;
  private readonly angle: number;
  private readonly angularSpeed: number;

  private transform: Transform;
  private clock: number;
  private offsetAmplitude: number;
  private offsetFrequency: number;

  public onCreate(): void {
    this.transform = this.requireComponent(Transform);
    this.clock = 0;
    this.offsetAmplitude = 8;
    this.offsetFrequency = 0.7;
  }

  public onUpdate(dt: number): void {
    this.clock += dt;

    const anchorWorld: Vec2 = this.anchor.requireComponent(Transform).worldPosition;
    const base: Vec2 = orbitBase(anchorWorld, this.r, this.angle, this.angularSpeed, this.clock);
    base.add(this.getFloatingOffset());

    this.transform.position.copyFrom(base);
  }

  private getFloatingOffset(): Vec2 {
    const w: number = 2 * Math.PI * this.offsetFrequency;
    const offset: number = Math.sin(w * this.clock) * this.offsetAmplitude;
    return new Vec2(0, offset);
  }
}

registerScriptMetadata(SwordScript, {
  exposed: {
    anchor: ScriptMetadata.entity({ required: true }),
    r: ScriptMetadata.field({ required: true }),
    angle: ScriptMetadata.field({ required: true }),
    angularSpeed: ScriptMetadata.field({ required: true }),
  },
});
```

- [ ] **Step 2: Réécrire `SwordShadowScript.ts`**

Remplacer tout le contenu de `apps/dino-brawl/src/game/scripts/SwordShadowScript.ts` par :

```ts
import { Vec2 } from "@atlasjs/math";

import {
  AtlasScript,
  registerScriptMetadata,
  ScriptMetadata,
  Transform,
  type GameEntity,
} from "@atlasjs/gameplay";

import { orbitBase } from "./orbit";

type SwordShadowScriptProps = {
  anchor: GameEntity;
  sword: GameEntity;
  r: number;
  angle: number;
  angularSpeed: number;
  shadowOffset: Vec2;
  scale: Vec2;
};

export class SwordShadowScript extends AtlasScript<SwordShadowScriptProps> {
  private readonly anchor: GameEntity;
  private readonly sword: GameEntity;
  private readonly r: number;
  private readonly angle: number;
  private readonly angularSpeed: number;
  private readonly shadowOffset: Vec2;
  private readonly scale: Vec2;

  private transform: Transform;
  private clock: number;

  public onCreate(): void {
    this.transform = this.requireComponent(Transform);
    this.clock = 0;
  }

  public onUpdate(dt: number): void {
    this.clock += dt;

    const anchorWorld: Vec2 = this.anchor.requireComponent(Transform).worldPosition;
    const base: Vec2 = orbitBase(anchorWorld, this.r, this.angle, this.angularSpeed, this.clock);

    const swordWorld: Vec2 = this.sword.requireComponent(Transform).worldPosition;
    const floatHeight: number = swordWorld.y - base.y;

    const shadowPosition: Vec2 = base.clone().add(this.shadowOffset);
    const scaleFactor: Vec2 = this.getScaleFactor(floatHeight, 8).mult(0.3);

    this.transform.position.copyFrom(shadowPosition);
    this.transform.scale.copyFrom(this.scale).add(scaleFactor);
  }

  private getScaleFactor(value: number, max: number): Vec2 {
    const offset: number = (value + max) / 2;
    const normalizedValue: number = offset / max;
    return new Vec2(normalizedValue, normalizedValue);
  }
}

registerScriptMetadata(SwordShadowScript, {
  exposed: {
    anchor: ScriptMetadata.entity({ required: true }),
    sword: ScriptMetadata.entity({ required: true }),
    r: ScriptMetadata.field({ required: true }),
    angle: ScriptMetadata.field({ required: true }),
    angularSpeed: ScriptMetadata.field({ required: true }),
    shadowOffset: ScriptMetadata.field({ required: true }),
    scale: ScriptMetadata.field({ required: true }),
  },
});
```

- [ ] **Step 3: Typecheck de l'app**

Run: `pnpm --filter dino-brawl exec tsc --noEmit`
Expected: aucune erreur. (Si erreur « child does not exist » plus tard, c'est que le `dist` de gameplay n'a pas été rebuild — Task 1 Step 6.)

- [ ] **Step 4: Formater, stager, remettre à l'utilisateur pour commit**

```bash
npx prettier --write apps/dino-brawl/src/game/scripts/SwordScript.ts apps/dino-brawl/src/game/scripts/SwordShadowScript.ts
git add apps/dino-brawl/src/game/scripts/SwordScript.ts apps/dino-brawl/src/game/scripts/SwordShadowScript.ts
# suggestion :
# git commit -m "feat(dino-brawl): orbit-driven sword + shadow scripts"
```

---

### Task 4: Prefab `SwordWithShadow` (enfants inline) + barrel + retrait des prefabs absorbés

**Files:**
- Create: `apps/dino-brawl/src/game/prefabs/SwordWithShadowPrefab.ts`
- Delete: `apps/dino-brawl/src/game/prefabs/SwordPrefab.ts`
- Delete: `apps/dino-brawl/src/game/prefabs/SwordShadowPrefab.ts`
- Modify: `apps/dino-brawl/src/game/prefabs/index.ts`

**Interfaces:**
- Consumes : `EntityBuilder.child()` (Task 1, via `dist`), `SwordScript`/`SwordShadowScript` (Task 3), `definePrefab`, `SpriteRender`, `Transform2D`, `Color`, `Sprite`, `SortingLayer`/`SortingOrder`.
- Produces : `createSwordWithShadowPrefab(): Prefab<SwordWithShadowPrefabProps>` avec
  `SwordWithShadowPrefabProps = { owner: Entity; anchor: Entity; r: number; angle: number; angularSpeed: number; swordSprite: Sprite; shadowSprite: Sprite; shadowOffset?: Vec2; shadowScale?: Vec2 }`.

- [ ] **Step 1: Créer `SwordWithShadowPrefab.ts`**

```ts
import { Vec2 } from "@atlasjs/math";
import type { Entity } from "@atlasjs/nexus";

import { SwordScript, SwordShadowScript } from "../scripts";
import { SortingLayer, SortingOrder } from "../config";

import {
  Color,
  definePrefab,
  Sprite,
  SpriteRender,
  Transform2D,
  type EntityBuilder,
} from "@atlasjs/gameplay";

export type SwordWithShadowPrefabProps = {
  owner: Entity;
  anchor: Entity;
  r: number;
  angle: number;
  angularSpeed: number;
  swordSprite: Sprite;
  shadowSprite: Sprite;
  shadowOffset?: Vec2;
  shadowScale?: Vec2;
};

export const createSwordWithShadowPrefab = () =>
  definePrefab<SwordWithShadowPrefabProps>({
    name: "sword_with_shadow",
    build: (entity: EntityBuilder, props: SwordWithShadowPrefabProps): void => {
      entity.add(Transform2D);

      const orbit = {
        anchor: props.anchor,
        r: props.r,
        angle: props.angle,
        angularSpeed: props.angularSpeed,
      };

      const sword: EntityBuilder = entity.child((e: EntityBuilder): void => {
        const renderer: SpriteRender = e.add(SpriteRender, props.swordSprite);
        renderer.sortingLayer = SortingLayer.Entities;
        renderer.sortingOrder = SortingOrder.Sword;
        renderer.sortPointEntity = props.owner;
        renderer.sprite.pivot.set(0, 0);

        const transform: Transform2D = e.add(Transform2D);
        transform.scale.set(1.5, 1.5);

        e.attach(SwordScript, orbit);
      });

      entity.child((e: EntityBuilder): void => {
        const renderer: SpriteRender = e.add(SpriteRender, props.shadowSprite);
        renderer.sortingLayer = SortingLayer.Entities;
        renderer.sortingOrder = SortingOrder.Shadow;
        renderer.color = new Color(0, 0, 0, 0.3);

        e.add(Transform2D);

        e.attach(SwordShadowScript, {
          ...orbit,
          sword: sword.entity,
          shadowOffset: props.shadowOffset ?? new Vec2(-16, -70),
          scale: props.shadowScale ?? new Vec2(0.5, 0.5),
        });
      });
    },
  });
```

> Note : `shadowOffset`/`shadowScale` par défaut sont des valeurs de **tuning visuel** — à confirmer/ajuster au browser-verify (Task 5).

- [ ] **Step 2: Supprimer les deux prefabs absorbés**

```bash
rm apps/dino-brawl/src/game/prefabs/SwordPrefab.ts apps/dino-brawl/src/game/prefabs/SwordShadowPrefab.ts
```

- [ ] **Step 3: Mettre à jour le barrel `prefabs/index.ts`**

Remplacer le contenu de `apps/dino-brawl/src/game/prefabs/index.ts` par :

```ts
export * from "./PlayerPrefab";
export * from "./RunningAudioPrefab";
export * from "./RunningParticlePrefab";
export * from "./ShadowPrefab";
export * from "./SwordAnchorPrefab";
export * from "./SwordWithShadowPrefab";
```

(Retrait de `./SwordPrefab` et `./SwordShadowPrefab`, ajout de `./SwordWithShadowPrefab`.)

- [ ] **Step 4: Typecheck de l'app**

Run: `pnpm --filter dino-brawl exec tsc --noEmit`
Expected: aucune erreur. (Vérifie notamment que `entity.child(...)` est bien typé — nécessite le `dist` gameplay de Task 1 Step 6.)

- [ ] **Step 5: Formater, stager, remettre à l'utilisateur pour commit**

```bash
npx prettier --write apps/dino-brawl/src/game/prefabs/SwordWithShadowPrefab.ts apps/dino-brawl/src/game/prefabs/index.ts
git add -A apps/dino-brawl/src/game/prefabs/
# suggestion :
# git commit -m "feat(dino-brawl): SwordWithShadow multi-entity prefab (inline children)"
```

---

### Task 5: Câbler l'anneau d'épées dans `spawnPlayer` + browser-verify

**Files:**
- Modify: `apps/dino-brawl/src/game/spawn/spawnPlayer.ts`

**Interfaces:**
- Consumes : `createSwordWithShadowPrefab` (Task 4), `Instantiator.instantiate`, `createSwordAnchorPrefab` (inchangé).
- Produces : un anneau de N `SwordWithShadow` autour de l'ancre du joueur.

- [ ] **Step 1: Mettre à jour `spawnPlayer.ts`**

Dans `apps/dino-brawl/src/game/spawn/spawnPlayer.ts` :

1. Dans le bloc d'import depuis `"../prefabs"`, remplacer les types/factories des prefabs épée/ombre par le nouveau. Retirer `type SwordPrefabProps`, `type SwordShadowPrefabProps`, `createSwordPrefab`, `createShadowPrefab` **(garder `createShadowPrefab`/`ShadowPrefabProps` — c'est l'ombre du dino, non concernée)**, `createSwordShadowPrefab`. Ajouter `type SwordWithShadowPrefabProps`, `createSwordWithShadowPrefab`.

Le bloc d'import devient :

```ts
import {
  type PlayerPrefabProps,
  type RunningParticlePrefabProps,
  type ShadowPrefabProps,
  type SwordWithShadowPrefabProps,
  type SwordAnchorPrefabProps,
  createRunningAudioPrefab,
  createRunningParticlePrefab,
  createPlayerPrefab,
  createShadowPrefab,
  createSwordWithShadowPrefab,
  createSwordAnchorPrefab,
} from "../prefabs";
```

2. Remplacer les déclarations de prefabs `swordPrefab`/`swordShadowPrefab` par le nouveau (garder `shadowPrefab` et `swordAnchorPrefab`) :

```ts
  const shadowPrefab: Prefab<ShadowPrefabProps> = createShadowPrefab();
  const swordWithShadowPrefab: Prefab<SwordWithShadowPrefabProps> = createSwordWithShadowPrefab();
  const swordAnchorPrefab: Prefab<SwordAnchorPrefabProps> = createSwordAnchorPrefab();
```

3. Remplacer les instanciations `sword` + `swordShadow` (les deux appels `instantiate(swordPrefab, …)` et `instantiate(swordShadowPrefab, …)`) par la boucle d'anneau (l'`anchor` reste créé juste avant, inchangé) :

```ts
  const swordCount: number = 6;
  for (let i: number = 0; i < swordCount; i++) {
    const angle: number = (i / swordCount) * Math.PI * 2;
    instantiator.instantiate(swordWithShadowPrefab, {
      owner: player.id,
      anchor: anchor.id,
      r: 40,
      angle,
      angularSpeed: 1.5,
      swordSprite,
      shadowSprite,
    });
  }
```

Les sprites `swordSprite` et `shadowSprite` sont **déjà déclarés** en tête de fonction (`assetsLoader.getAsset("sprite:default_sword")` / `"sprite:shadow"`) — la boucle les réutilise. L'ombre de dino (`instantiate(shadowPrefab, …, { parent: player.id })`) reste **inchangée**.

- [ ] **Step 2: Typecheck de l'app**

Run: `pnpm --filter dino-brawl exec tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Lancer le dev server et ouvrir le preview**

Utiliser l'outil de preview : `preview_start({ name: "dino-brawl" })` (config `launch.json`, port 5173). Si un serveur tournait déjà avec du HMR périmé, le **redémarrer** (gotcha connu : HMR sert une scène périmée sur WebGPU).

- [ ] **Step 4: Vérifier visuellement + console**

- `read_console_messages` / `preview_logs` → aucune erreur (ni « prop non exposé », ni exception de script).
- `computer { action: "screenshot" }` → observer : **6 épées** réparties en cercle autour du joueur, chacune **flotte** verticalement (sin), l'**anneau tourne** (orbite), chaque épée a une **ombre** dessous qui **suit l'orbite mais ne monte/descend pas** avec le flottement ; l'anneau **suit le joueur** quand il se déplace ; le tri (foot-sort) place les épées correctement devant/derrière le joueur.
- Si le placement d'ombre (`shadowOffset` / `shadowScale`) ou le rayon `r` / la vitesse `angularSpeed` demandent un ajustement esthétique, ajuster les valeurs (dans `SwordWithShadowPrefab` pour les défauts d'ombre, dans `spawnPlayer` pour `r`/`angularSpeed`/`swordCount`) puis recharger.

- [ ] **Step 5: Formater, stager, remettre à l'utilisateur pour commit**

```bash
npx prettier --write apps/dino-brawl/src/game/spawn/spawnPlayer.ts
git add apps/dino-brawl/src/game/spawn/spawnPlayer.ts
# suggestion :
# git commit -m "feat(dino-brawl): spawn a ring of orbiting SwordWithShadow prefabs"
```

---

### Task 6: Documentation

**Files:**
- Modify: `docs/gameplay/prefab-multi-entity.md`
- Modify: `docs/gameplay/prefab.md`
- Modify: `docs/backlog.md`

> **Édition sémantique uniquement** — ne pas reformater ces `.md` (pas de prettier, pas de re-wrap de tables).

- [ ] **Step 1: Passer la spec en « implémenté »**

Dans `docs/gameplay/prefab-multi-entity.md`, remplacer la ligne de statut :

```
> **Statut : 🧭 design (validé, pas encore implémenté).**
```

par :

```
> **Statut : ✅ implémenté.**
```

- [ ] **Step 2: Mettre à jour `prefab.md` §10 (V2 → implémenté)**

Dans `docs/gameplay/prefab.md`, section §10, remplacer le bullet :

```
- **Prefabs multi-entités avec références internes** (dino + ombre d'un bloc, un script référençant un
  frère du même prefab) — le vrai gros morceau : création d'enfants dans le builder (`entity.child()`)
  + **remap des références internes** vers les instances fraîches. Reporté (choix mono-racine).
```

par :

```
- **Prefabs multi-entités avec enfants inline** — ✅ **implémenté** via `EntityBuilder.child(buildFn)`
  (voir [`prefab-multi-entity.md`](prefab-multi-entity.md)) : enfants créés synchronement dans le
  `build`, références internes câblées par capture directe du `.entity` du handle retourné (pas de
  remap). Le **remap de références sérialisées** (prefab JSON / éditeur) reste V2.
```

- [ ] **Step 3: Ajouter les entrées de backlog**

Dans `docs/backlog.md`, sous la section gameplay/prefab (à l'endroit cohérent avec l'organisation existante), ajouter :

```
- **Prefab `child(subPrefab, params)`** — variante de `EntityBuilder.child()` composant un sous-prefab
  réutilisable (en plus du callback inline). Voir `docs/gameplay/prefab-multi-entity.md` §9.
- **Propagation à travers des nœuds de groupe sans transform** — permettre à
  `TransformPropagationSystem` de descendre depuis une racine sans `Transform2D` (aujourd'hui la racine
  d'un groupe porte un `Transform2D` identité). Voir `docs/gameplay/prefab-multi-entity.md` §4.
```

- [ ] **Step 4: Stager, remettre à l'utilisateur pour commit**

```bash
git add docs/gameplay/prefab-multi-entity.md docs/gameplay/prefab.md docs/backlog.md
# suggestion :
# git commit -m "docs(gameplay): mark multi-entity prefab implemented + backlog"
```

---

## Verification finale (après toutes les tâches)

- `pnpm --filter @atlasjs/gameplay test` → tous verts (dont `prefab-child`).
- `pnpm --filter dino-brawl test` → vert (dont `orbit`).
- `pnpm --filter @atlasjs/gameplay exec tsc --noEmit` et `pnpm --filter dino-brawl exec tsc --noEmit` → sans erreur.
- Browser-verify dino-brawl : anneau de 6 épées flottantes en orbite, ombres fixes verticalement mais suivant l'orbite, l'ensemble suit le joueur, foot-sort correct, console propre.
