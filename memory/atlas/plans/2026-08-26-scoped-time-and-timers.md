# Temps périmétré et timers de script — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au moteur une échelle de temps héritée par sous-arbre, puis une API de timers pour les scripts, et supprimer les deux hitstops et les huit horloges écrits à la main dans `apps/dino-brawl`.

**Architecture:** Un composant `TimeScale` posé sur une entité vaut pour tout son sous-arbre ; un `TimeScaleManager` résout l'échelle effective **à la lecture** en remontant la chaîne de parents, avec un mémo par frame et un court-circuit total quand aucun `TimeScale` n'existe. `ScriptManager` et `AnimatorSystem` multiplient leur `dt` par cette échelle. Les timers sont des objets passifs (ou répétiteurs) portés par le `ScriptContext` d'un script, avancés par `ScriptManager.update` avec ce même `dt` scopé, et annulés à la destruction du script.

**Tech Stack:** TypeScript, monorepo pnpm + Turborepo, vitest, `@atlasjs/nexus` (ECS), `@atlasjs/core` (Engine/Scheduler/ServiceRegistry).

**Spec :** [`memory/atlas/gameplay/scoped-time-and-timers.md`](../gameplay/scoped-time-and-timers.md)
**Backlog :** [[GAMEPLAY-97-scoped-hitstop-timescale]], [[GAMEPLAY-96-script-timers]], [[APP-15-attack-chain-reset-ignores-hitstop]]

---

## Global Constraints

- **Ne jamais committer.** Chaque tâche se termine par un arrêt : l'humain relit et commit lui-même. Aucune étape `git commit` dans ce plan.
- **Tout typer explicitement**, même trivialement : paramètres de fonction, variables locales, champs de classe.
- **Ne pas ajouter de commentaires.** Une courte docstring `/** … */` est acceptable seulement là où le fichier voisin en porte déjà.
- **`import type`** pour tout symbole purement typé dans `apps/dino-brawl` (`verbatimModuleSyntax: true`). Un import de valeur pour un type passe `tsc` et casse au runtime sous Vite.
- **Reconstruire le `dist` du package après toute modification d'API publique** : `pnpm --filter @atlasjs/gameplay build`. `apps/dino-brawl` résout `@atlasjs/gameplay` par son champ `exports` → `./dist`, et verra l'ancienne API sans ça.
- **Prettier avant de rendre la main**, sur les fichiers `.ts` touchés uniquement : `pnpm exec prettier --write <chemins>`. Jamais sur le dépôt entier, jamais sur les `.md` du vault.
- Le fichier `ScriptManager.ts` et `AtlasScript.ts` portent des directives `// prettier-ignore` sur certaines classes : les conserver.
- **Descriptions de test en anglais.** Les chaînes `describe(...)`/`it(...)` s'écrivent en anglais, comme le reste du dépôt — jamais en français.

**Commandes de référence**

```bash
pnpm --filter @atlasjs/gameplay test
pnpm --filter @atlasjs/gameplay typecheck
pnpm --filter @atlasjs/gameplay build
pnpm --filter dino-brawl test
pnpm --filter dino-brawl exec tsc --noEmit -p tsconfig.app.json
```

> Un `tsc --noEmit` nu dans `apps/dino-brawl` est un **no-op** : il faut `-p tsconfig.app.json`.

---

# Partie A — GAMEPLAY-97 : échelle de temps par périmètre

---

### Task 1: Le composant `TimeScale` et la résolution héritée

**Files:**
- Create: `packages/gameplay/src/components/TimeScale.ts`
- Create: `packages/gameplay/src/time/TimeScaleManager.ts`
- Create: `packages/gameplay/src/time/tokens.ts`
- Create: `packages/gameplay/src/time/index.ts`
- Modify: `packages/gameplay/src/components/index.ts`
- Modify: `packages/gameplay/src/index.ts:8-14`
- Modify: `packages/gameplay/src/GameplayPlugin.ts` (import, `defineComponents`, création + `provide`, `provides`)
- Test: `packages/gameplay/test/time-scale-manager.test.ts`

**Interfaces:**
- Consumes: `NexusWorld.getParent(child: Entity): Entity | undefined`, `NexusWorld.query(...)` , `ServiceRegistry.createToken`.
- Produces:
  - `class TimeScale { constructor(value?: number); get value(): number; set value(v: number) }` — clampé à `>= 0`, défaut `1`.
  - `const TIME_SCALE_MANAGER: ServiceToken<TimeScaleManager>`
  - `class TimeScaleManager { constructor(world: NexusWorld); scaleOf(entity: Entity): number; beginFrame(): void }`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `packages/gameplay/test/time-scale-manager.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import { TimeScale } from "../src/components";
import { TimeScaleManager, TIME_SCALE_MANAGER } from "../src/time";
import { createHarness, Harness } from "./helpers/harness";

describe("TimeScaleManager.scaleOf", () => {
  it("rend 1 pour une entité sans TimeScale nulle part", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.beginFrame();

    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("applique l'échelle portée par l'entité elle-même", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, TimeScale, 0.5);

    manager.beginFrame();

    expect(manager.scaleOf(entity)).toBe(0.5);
  });

  it("hérite l'échelle d'un ancêtre", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const root: Entity = harness.world.createEntity();
    const child: Entity = harness.world.createEntity();
    const grandChild: Entity = harness.world.createEntity();

    harness.world.setParent(child, root);
    harness.world.setParent(grandChild, child);
    harness.world.addComponent(root, TimeScale, 0);

    manager.beginFrame();

    expect(manager.scaleOf(grandChild)).toBe(0);
  });

  it("multiplie les échelles imbriquées", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const root: Entity = harness.world.createEntity();
    const child: Entity = harness.world.createEntity();

    harness.world.setParent(child, root);
    harness.world.addComponent(root, TimeScale, 0.5);
    harness.world.addComponent(child, TimeScale, 0.5);

    manager.beginFrame();

    expect(manager.scaleOf(child)).toBe(0.25);
  });

  it("laisse un sous-arbre voisin à 1", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const frozen: Entity = harness.world.createEntity();
    const other: Entity = harness.world.createEntity();

    harness.world.addComponent(frozen, TimeScale, 0);

    manager.beginFrame();

    expect(manager.scaleOf(frozen)).toBe(0);
    expect(manager.scaleOf(other)).toBe(1);
  });

  it("clampe une valeur négative à 0", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, TimeScale, -3);

    manager.beginFrame();

    expect(manager.scaleOf(entity)).toBe(0);
  });

  it("ne remonte aucun parent quand le monde ne porte aucun TimeScale", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const root: Entity = harness.world.createEntity();
    const child: Entity = harness.world.createEntity();
    harness.world.setParent(child, root);

    let parentLookups: number = 0;
    const realGetParent = harness.world.getParent.bind(harness.world);
    harness.world.getParent = (entity: Entity): Entity | undefined => {
      parentLookups += 1;
      return realGetParent(entity);
    };

    manager.beginFrame();
    manager.scaleOf(child);

    expect(parentLookups).toBe(0);
  });

  it("prend en compte un TimeScale ajouté après le beginFrame de la frame précédente", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.beginFrame();
    expect(manager.scaleOf(entity)).toBe(1);

    harness.world.addComponent(entity, TimeScale, 0);
    manager.beginFrame();

    expect(manager.scaleOf(entity)).toBe(0);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
pnpm --filter @atlasjs/gameplay exec vitest run test/time-scale-manager.test.ts
```

Attendu : ÉCHEC à la résolution des imports — `Cannot find module '../src/time'`.

- [ ] **Step 3: Écrire le composant**

`packages/gameplay/src/components/TimeScale.ts` :

```ts
export class TimeScale {
  private stored: number;

  public constructor(value: number = 1) {
    this.stored = Math.max(0, value);
  }

  public get value(): number {
    return this.stored;
  }

  public set value(next: number) {
    this.stored = Math.max(0, next);
  }
}
```

Ajouter dans `packages/gameplay/src/components/index.ts`, en respectant l'ordre alphabétique (entre `./TileMapRenderer` et `./TrailRenderer`) :

```ts
export * from "./TimeScale";
```

- [ ] **Step 4: Écrire le token**

`packages/gameplay/src/time/tokens.ts` :

```ts
import { ServiceRegistry, ServiceToken } from "@atlasjs/core";

import type { TimeScaleManager } from "./TimeScaleManager";

export const TIME_SCALE_MANAGER: ServiceToken<TimeScaleManager> =
  ServiceRegistry.createToken("TIME_SCALE_MANAGER");
```

`packages/gameplay/src/time/index.ts` :

```ts
export * from "./TimeScaleManager";
export * from "./tokens";
```

- [ ] **Step 5: Écrire le manager**

`packages/gameplay/src/time/TimeScaleManager.ts` :

```ts
import { Entity, NexusWorld } from "@atlasjs/nexus";

import { TimeScale } from "../components";

export class TimeScaleManager {
  private readonly world: NexusWorld;
  private readonly memo: Map<Entity, number>;

  private active: boolean;

  public constructor(world: NexusWorld) {
    this.world = world;
    this.memo = new Map<Entity, number>();
    this.active = false;
  }

  public beginFrame(): void {
    this.memo.clear();
    this.active = this.world.query(TimeScale).getEntities().length > 0;
  }

  public scaleOf(entity: Entity): number {
    if (!this.active) {
      return 1;
    }

    const memoized: number | undefined = this.memo.get(entity);

    if (memoized !== undefined) {
      return memoized;
    }

    const own: TimeScale | undefined = this.world.getComponent(
      entity,
      TimeScale,
    );

    const local: number = own === undefined ? 1 : own.value;
    const parent: Entity | undefined = this.world.getParent(entity);
    const inherited: number = parent === undefined ? 1 : this.scaleOf(parent);
    const resolved: number = local * inherited;

    this.memo.set(entity, resolved);

    return resolved;
  }
}
```

- [ ] **Step 6: Câbler le manager dans `GameplayPlugin`**

Dans `packages/gameplay/src/GameplayPlugin.ts` :

1. Ajouter l'import après `import { CameraManager, CAMERA_MANAGER } from "./camera";` :

```ts
import { TimeScaleManager, TIME_SCALE_MANAGER } from "./time";
```

2. Ajouter `TimeScale` à la liste d'imports de `./components`, en respectant l'ordre alphabétique existant.

3. Dans le constructeur, ajouter le token à `provides` :

```ts
provides: [SCRIPT_MANAGER, INSTANTIATOR, CAMERA_MANAGER, SORTING_LAYERS, TIME_SCALE_MANAGER],
```

4. Dans `install`, **avant** la ligne `this.scriptManager = new ScriptManager(world, engine.services);` :

```ts
const timeScaleManager: TimeScaleManager = new TimeScaleManager(world);
engine.services.provide(TIME_SCALE_MANAGER, timeScaleManager);
```

5. Dans `defineComponents`, ajouter un maillon à la chaîne :

```ts
.defineComponent(TimeScale)
```

6. Exporter le module depuis `packages/gameplay/src/index.ts`, après `export * from "./camera";` :

```ts
export * from "./time";
```

- [ ] **Step 7: Lancer le test pour vérifier qu'il passe**

```bash
pnpm --filter @atlasjs/gameplay exec vitest run test/time-scale-manager.test.ts
```

Attendu : 8 tests PASS.

- [ ] **Step 8: Vérifier la non-régression et rendre la main**

```bash
pnpm --filter @atlasjs/gameplay test
pnpm --filter @atlasjs/gameplay typecheck
pnpm exec prettier --write packages/gameplay/src/components/TimeScale.ts packages/gameplay/src/components/index.ts packages/gameplay/src/time/TimeScaleManager.ts packages/gameplay/src/time/tokens.ts packages/gameplay/src/time/index.ts packages/gameplay/src/GameplayPlugin.ts packages/gameplay/src/index.ts packages/gameplay/test/time-scale-manager.test.ts
```

Attendu : toute la suite du package verte, `typecheck` sans erreur. **S'arrêter ici** — l'humain relit et commit.

---

### Task 2: `freeze`, son décompte, et l'avance par frame

**Files:**
- Modify: `packages/gameplay/src/time/TimeScaleManager.ts`
- Modify: `packages/gameplay/src/GameplayPlugin.ts` (`registerSteps`)
- Test: `packages/gameplay/test/time-freeze.test.ts`

**Interfaces:**
- Consumes: `TimeScaleManager` de la Task 1, `Scheduler.update.add(cb, { name, stage })`, `StepContext.dt`.
- Produces:
  - `TimeScaleManager.freeze(seconds: number, entities: readonly Entity[]): void`
  - `TimeScaleManager.setScale(entity: Entity, value: number): void`
  - `TimeScaleManager.clearScale(entity: Entity): void`
  - `TimeScaleManager.update(dt: number): void` — remplace l'appel direct à `beginFrame` côté plugin ; `beginFrame` reste public et appelé par `update`.
  - Étape de scheduler nommée `gameplay:time-scale`, lane `update`, stage `Early`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `packages/gameplay/test/time-freeze.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { TIME, TimeControl } from "@atlasjs/core";
import { Entity } from "@atlasjs/nexus";

import { TimeScale } from "../src/components";
import { TimeScaleManager, TIME_SCALE_MANAGER } from "../src/time";
import { createHarness, Harness } from "./helpers/harness";

describe("TimeScaleManager.freeze", () => {
  it("met l'échelle à 0 puis la restaure après la durée", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.2, [entity]);
    manager.update(0);
    expect(manager.scaleOf(entity)).toBe(0);

    manager.update(0.1);
    expect(manager.scaleOf(entity)).toBe(0);

    manager.update(0.15);
    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("retire le composant quand l'entité n'en portait pas avant", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.1, [entity]);
    manager.update(0.5);

    expect(harness.world.getComponent(entity, TimeScale)).toBeUndefined();
  });

  it("restaure la valeur précédente, pas 1", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, TimeScale, 0.5);

    manager.freeze(0.1, [entity]);
    manager.update(0.5);
    manager.update(0);

    expect(manager.scaleOf(entity)).toBe(0.5);
  });

  it("gèle plusieurs entités dans le même appel", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const attacker: Entity = harness.world.createEntity();
    const victim: Entity = harness.world.createEntity();

    manager.freeze(0.2, [attacker, victim]);
    manager.update(0);

    expect(manager.scaleOf(attacker)).toBe(0);
    expect(manager.scaleOf(victim)).toBe(0);
  });

  it("un second freeze prolonge sans mémoriser 0 comme valeur précédente", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, TimeScale, 0.5);

    manager.freeze(0.1, [entity]);
    manager.update(0.05);
    manager.freeze(0.3, [entity]);

    manager.update(0.2);
    expect(manager.scaleOf(entity)).toBe(0);

    manager.update(0.2);
    expect(manager.scaleOf(entity)).toBe(0.5);
  });

  it("un freeze de durée nulle ou négative ne gèle rien", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0, [entity]);
    manager.update(0);

    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("setScale et clearScale posent et retirent le composant", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.setScale(entity, 0.25);
    manager.update(0);
    expect(manager.scaleOf(entity)).toBe(0.25);

    manager.setScale(entity, 2);
    manager.update(0);
    expect(manager.scaleOf(entity)).toBe(2);

    manager.clearScale(entity);
    manager.update(0);
    expect(manager.scaleOf(entity)).toBe(1);
  });
});

describe("gameplay:time-scale", () => {
  it("avance le décompte une fois par frame", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.2, [entity]);

    harness.frame();
    expect(manager.scaleOf(entity)).toBe(0);

    harness.frame();
    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("une pause globale suspend aussi le décompte d'un gel", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const time: TimeControl = harness.services.get(TIME);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.2, [entity]);
    time.scale = 0;

    harness.frame();
    harness.frame();
    harness.frame();

    expect(manager.scaleOf(entity)).toBe(0);

    time.scale = 1;
    harness.frame();
    harness.frame();

    expect(manager.scaleOf(entity)).toBe(1);
  });
});
```

> `harness.frame()` avance de `0.15` s (`FIXED = 0.1`, plus une demi-marche de slack).

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
pnpm --filter @atlasjs/gameplay exec vitest run test/time-freeze.test.ts
```

Attendu : ÉCHEC — `manager.freeze is not a function`.

- [ ] **Step 3: Implémenter `freeze`, `setScale`, `clearScale` et `update`**

Réécrire `packages/gameplay/src/time/TimeScaleManager.ts` :

```ts
import { Entity, NexusWorld } from "@atlasjs/nexus";

import { TimeScale } from "../components";

type FreezeRecord = {
  remaining: number;
  previous: number | undefined;
};

export class TimeScaleManager {
  private readonly world: NexusWorld;
  private readonly memo: Map<Entity, number>;
  private readonly freezes: Map<Entity, FreezeRecord>;
  private readonly expired: Entity[];

  private active: boolean;

  public constructor(world: NexusWorld) {
    this.world = world;
    this.memo = new Map<Entity, number>();
    this.freezes = new Map<Entity, FreezeRecord>();
    this.expired = [];
    this.active = false;
  }

  public update(dt: number): void {
    this.advanceFreezes(dt);
    this.beginFrame();
  }

  public beginFrame(): void {
    this.memo.clear();
    this.active = this.world.query(TimeScale).getEntities().length > 0;
  }

  public scaleOf(entity: Entity): number {
    if (!this.active) {
      return 1;
    }

    const memoized: number | undefined = this.memo.get(entity);

    if (memoized !== undefined) {
      return memoized;
    }

    const own: TimeScale | undefined = this.world.getComponent(
      entity,
      TimeScale,
    );

    const local: number = own === undefined ? 1 : own.value;
    const parent: Entity | undefined = this.world.getParent(entity);
    const inherited: number = parent === undefined ? 1 : this.scaleOf(parent);
    const resolved: number = local * inherited;

    this.memo.set(entity, resolved);

    return resolved;
  }

  public setScale(entity: Entity, value: number): void {
    const existing: TimeScale | undefined = this.world.getComponent(
      entity,
      TimeScale,
    );

    if (existing === undefined) {
      this.world.addComponent(entity, TimeScale, value);
      return;
    }

    existing.value = value;
  }

  public clearScale(entity: Entity): void {
    if (this.world.getComponent(entity, TimeScale) !== undefined) {
      this.world.removeComponent(entity, TimeScale);
    }
  }

  public freeze(seconds: number, entities: readonly Entity[]): void {
    if (seconds <= 0) {
      return;
    }

    for (let i: number = 0; i < entities.length; i++) {
      this.freezeOne(seconds, entities[i]);
    }
  }

  private freezeOne(seconds: number, entity: Entity): void {
    const running: FreezeRecord | undefined = this.freezes.get(entity);

    if (running !== undefined) {
      running.remaining = Math.max(running.remaining, seconds);
      return;
    }

    const existing: TimeScale | undefined = this.world.getComponent(
      entity,
      TimeScale,
    );

    this.freezes.set(entity, {
      remaining: seconds,
      previous: existing === undefined ? undefined : existing.value,
    });

    this.setScale(entity, 0);
  }

  private advanceFreezes(dt: number): void {
    if (this.freezes.size === 0) {
      return;
    }

    this.expired.length = 0;

    for (const [entity, record] of this.freezes) {
      record.remaining -= dt;

      if (record.remaining <= 0) {
        this.expired.push(entity);
      }
    }

    for (let i: number = 0; i < this.expired.length; i++) {
      const entity: Entity = this.expired[i];
      const record: FreezeRecord = this.freezes.get(entity)!;

      this.freezes.delete(entity);

      if (record.previous === undefined) {
        this.clearScale(entity);
        continue;
      }

      this.setScale(entity, record.previous);
    }

    this.expired.length = 0;
  }
}
```

- [ ] **Step 4: Enregistrer l'étape de scheduler**

Dans `packages/gameplay/src/GameplayPlugin.ts`, `registerSteps` : ajouter le paramètre `timeScaleManager: TimeScaleManager` à la signature, le passer depuis `install`, et enregistrer l'étape **en premier** dans `this.handles.push(...)`, avant `gameplay:script-fixed` :

```ts
this.handles.push(
  update.add((ctx: StepContext) => timeScaleManager.update(ctx.dt), {
    name: "gameplay:time-scale",
    stage: "Early",
  }),
);
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

```bash
pnpm --filter @atlasjs/gameplay exec vitest run test/time-freeze.test.ts
```

Attendu : 9 tests PASS.

> Le test de pause globale n'exige aucun code supplémentaire : l'étape lit `ctx.dt` de la lane `update`, que `Engine.startLoop` a déjà multiplié par le `scale` global (`packages/core/src/public/engine/Engine.ts:254`). Il verrouille un effet de bord voulu du design, pas une fonctionnalité à écrire.

- [ ] **Step 6: Vérifier et rendre la main**

```bash
pnpm --filter @atlasjs/gameplay test
pnpm --filter @atlasjs/gameplay typecheck
pnpm exec prettier --write packages/gameplay/src/time/TimeScaleManager.ts packages/gameplay/src/GameplayPlugin.ts packages/gameplay/test/time-freeze.test.ts
```

Attendu : suite verte. **S'arrêter** — l'humain commit.

---

### Task 3: `TimeApi` bascule sur le manager

**Files:**
- Modify: `packages/gameplay/src/scripting/services/TimeApi.ts`
- Modify: `packages/gameplay/src/time/TimeScaleManager.ts` (passthrough du `scale` global)
- Modify: `packages/gameplay/src/GameplayPlugin.ts` (le manager reçoit le `TimeControl`)
- Test: `packages/gameplay/test/time-api.test.ts`

**Interfaces:**
- Consumes: `TIME` et `TimeControl` de `@atlasjs/core`, `TimeScaleManager` des tâches 1-2.
- Produces:
  - `TimeScaleManager.constructor(world: NexusWorld, time: TimeControl)`
  - `TimeScaleManager.globalScale` (get/set, délègue à `TimeControl.scale`)
  - `class TimeApi extends ScriptService<TimeScaleManager>` avec `static token = TIME_SCALE_MANAGER`, `get/set scale`, `scaleOf(entity)`, `setScale(entity, value)`, `clearScale(entity)`, `freeze(seconds, ...entities)`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `packages/gameplay/test/time-api.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { TIME, TimeControl } from "@atlasjs/core";
import { Entity } from "@atlasjs/nexus";

import { TIME_SCALE_MANAGER, TimeScaleManager } from "../src/time";
import { TimeApi } from "../src/scripting/services";
import { createHarness, Harness } from "./helpers/harness";

describe("TimeApi", () => {
  it("expose le token TIME_SCALE_MANAGER", () => {
    expect(TimeApi.token).toBe(TIME_SCALE_MANAGER);
  });

  it("relaie le scale global au TimeControl du coeur", async () => {
    const harness: Harness = await createHarness();
    const api: TimeApi = new TimeApi(harness.services);
    const time: TimeControl = harness.services.get(TIME);

    api.scale = 0.25;

    expect(time.scale).toBe(0.25);
    expect(api.scale).toBe(0.25);
  });

  it("freeze gèle les entités passées et les libère après la durée", async () => {
    const harness: Harness = await createHarness();
    const api: TimeApi = new TimeApi(harness.services);
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const attacker: Entity = harness.world.createEntity();
    const victim: Entity = harness.world.createEntity();

    api.freeze(0.2, attacker, victim);
    manager.update(0);

    expect(api.scaleOf(attacker)).toBe(0);
    expect(api.scaleOf(victim)).toBe(0);

    manager.update(0.5);

    expect(api.scaleOf(attacker)).toBe(1);
    expect(api.scaleOf(victim)).toBe(1);
  });

  it("setScale puis clearScale font l'aller-retour", async () => {
    const harness: Harness = await createHarness();
    const api: TimeApi = new TimeApi(harness.services);
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    api.setScale(entity, 0.5);
    manager.update(0);
    expect(api.scaleOf(entity)).toBe(0.5);

    api.clearScale(entity);
    manager.update(0);
    expect(api.scaleOf(entity)).toBe(1);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
pnpm --filter @atlasjs/gameplay exec vitest run test/time-api.test.ts
```

Attendu : ÉCHEC — `expected TIME to be TIME_SCALE_MANAGER`.

- [ ] **Step 3: Donner le `TimeControl` au manager**

Dans `packages/gameplay/src/time/TimeScaleManager.ts`, ajouter l'import et le champ, et étendre le constructeur :

```ts
import { TimeControl } from "@atlasjs/core";
```

```ts
  private readonly time: TimeControl;

  public constructor(world: NexusWorld, time: TimeControl) {
    this.world = world;
    this.time = time;
    this.memo = new Map<Entity, number>();
    this.freezes = new Map<Entity, FreezeRecord>();
    this.expired = [];
    this.active = false;
  }

  public get globalScale(): number {
    return this.time.scale;
  }

  public set globalScale(value: number) {
    this.time.scale = value;
  }
```

Dans `packages/gameplay/src/GameplayPlugin.ts`, `install` : récupérer le service et le passer.

```ts
const time: TimeControl = await engine.services.wait(TIME);
const timeScaleManager: TimeScaleManager = new TimeScaleManager(world, time);
```

Ajouter `TIME` et `TimeControl` à l'import de `@atlasjs/core` en tête de fichier.

> **Correction (constatée à l'implémentation) :** ne **pas** ajouter `TIME` à `requires`. `TIME` est injecté directement dans `services` par le constructeur d'`Engine` (`packages/core/src/public/engine/Engine.ts:78`), hors du graphe `provides`/`requires`. Comme aucun plugin ne le déclare en `provides`, `resolveInstallOrder` lève `MissingDependencyError` au boot : 222 tests sur 468 tombent. Le `await engine.services.wait(TIME)` fonctionne sans cette déclaration, le service étant disponible avant toute installation de plugin.

- [ ] **Step 4: Réécrire `TimeApi`**

`packages/gameplay/src/scripting/services/TimeApi.ts` :

```ts
import { Entity } from "@atlasjs/nexus";

import { TIME_SCALE_MANAGER, TimeScaleManager } from "../../time";

import { ScriptService } from "../core";

export class TimeApi extends ScriptService<TimeScaleManager> {
  public static readonly token = TIME_SCALE_MANAGER;

  /** 1 is real time, 0 freezes the simulation. Clamped to 0 or above. */
  public get scale(): number {
    return this.provided.globalScale;
  }

  public set scale(value: number) {
    this.provided.globalScale = value;
  }

  public scaleOf(entity: Entity): number {
    return this.provided.scaleOf(entity);
  }

  public setScale(entity: Entity, value: number): void {
    this.provided.setScale(entity, value);
  }

  public clearScale(entity: Entity): void {
    this.provided.clearScale(entity);
  }

  public freeze(seconds: number, ...entities: Entity[]): void {
    this.provided.freeze(seconds, entities);
  }
}
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

```bash
pnpm --filter @atlasjs/gameplay exec vitest run test/time-api.test.ts
```

Attendu : 4 tests PASS.

- [ ] **Step 6: Vérifier et rendre la main**

```bash
pnpm --filter @atlasjs/gameplay test
pnpm --filter @atlasjs/gameplay typecheck
pnpm exec prettier --write packages/gameplay/src/scripting/services/TimeApi.ts packages/gameplay/src/time/TimeScaleManager.ts packages/gameplay/src/GameplayPlugin.ts packages/gameplay/test/time-api.test.ts
```

**S'arrêter** — l'humain commit.

---

### Task 4: `ScriptManager.update` livre le `dt` du périmètre

**Files:**
- Modify: `packages/gameplay/src/scripting/runtime/ScriptManager.ts:29-70` (champ + résolution) et `:131-135` (`update`)
- Test: `packages/gameplay/test/script-scoped-dt.test.ts`

**Interfaces:**
- Consumes: `TIME_SCALE_MANAGER`, `TimeScaleManager.scaleOf`.
- Produces: `ScriptManager.update(dt)` appelle `onUpdate(dt * scaleOf(entityId))`.

> **Contrainte de compatibilité :** six tests existants construisent `new ScriptManager(h.world, h.services, logger)`. **Ne pas changer la signature.** Le manager résout `TIME_SCALE_MANAGER` depuis `services` s'il est présent, et retombe sinon sur un résolveur constant à 1.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `packages/gameplay/test/script-scoped-dt.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import { AtlasScript } from "../src/scripting";
import { TIME_SCALE_MANAGER, TimeScaleManager } from "../src/time";
import { createHarness, Harness } from "./helpers/harness";

class DtProbe extends AtlasScript {
  public readonly seen: number[] = [];

  public onUpdate(dt: number): void {
    this.seen.push(dt);
  }
}

describe("ScriptManager scoped dt", () => {
  it("delivers the raw dt when no scale is set", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    const probe: DtProbe = harness.scripts.attach(entity, DtProbe);

    harness.frame();

    expect(probe.seen).toEqual([0.15]);
  });

  it("delivers 0 to a frozen script", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    const probe: DtProbe = harness.scripts.attach(entity, DtProbe);

    manager.setScale(entity, 0);
    harness.frame();

    expect(probe.seen).toEqual([0]);
  });

  it("still calls onUpdate on a frozen script", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    const probe: DtProbe = harness.scripts.attach(entity, DtProbe);

    manager.setScale(entity, 0);
    harness.frame();
    harness.frame();

    expect(probe.seen.length).toBe(2);
  });

  it("a frozen subtree does not affect its sibling", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);

    const frozenRoot: Entity = harness.world.createEntity();
    const frozenChild: Entity = harness.world.createEntity();
    harness.world.setParent(frozenChild, frozenRoot);

    const free: Entity = harness.world.createEntity();

    const frozen: DtProbe = harness.scripts.attach(frozenChild, DtProbe);
    const running: DtProbe = harness.scripts.attach(free, DtProbe);

    manager.setScale(frozenRoot, 0);
    harness.frame();

    expect(frozen.seen).toEqual([0]);
    expect(running.seen).toEqual([0.15]);
  });

  it("applies a fractional scale", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    const probe: DtProbe = harness.scripts.attach(entity, DtProbe);

    manager.setScale(entity, 0.5);
    harness.frame();

    expect(probe.seen[0]).toBeCloseTo(0.075);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
pnpm --filter @atlasjs/gameplay exec vitest run test/script-scoped-dt.test.ts
```

Attendu : le 2e test ÉCHOUE — reçu `[0.15]`, attendu `[0]`.

- [ ] **Step 3: Résoudre le manager dans `ScriptManager`**

Dans `packages/gameplay/src/scripting/runtime/ScriptManager.ts`, ajouter l'import :

```ts
import { TIME_SCALE_MANAGER, TimeScaleManager } from "../../time";
```

Ajouter le champ à la liste des `private readonly` :

```ts
private readonly timeScale: TimeScaleManager | undefined;
```

Dans le constructeur, après `this.services = services;` :

```ts
this.timeScale = services.has(TIME_SCALE_MANAGER)
  ? services.get(TIME_SCALE_MANAGER)
  : undefined;
```

Ajouter la méthode privée, à côté de `resolveRecord` :

```ts
private scaleFor(entityId: Entity): number {
  return this.timeScale === undefined ? 1 : this.timeScale.scaleOf(entityId);
}
```

- [ ] **Step 4: Appliquer l'échelle dans `update`**

Remplacer `ScriptManager.update` :

```ts
public update(dt: number): void {
  this.runLifecycle("onUpdate", (record: ScriptInstanceRecord): void => {
    record.instance.onUpdate?.(dt * this.scaleFor(record.entityId));
  });
}
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

```bash
pnpm --filter @atlasjs/gameplay exec vitest run test/script-scoped-dt.test.ts
```

Attendu : 5 tests PASS.

- [ ] **Step 6: Vérifier et rendre la main**

```bash
pnpm --filter @atlasjs/gameplay test
pnpm --filter @atlasjs/gameplay typecheck
pnpm exec prettier --write packages/gameplay/src/scripting/runtime/ScriptManager.ts packages/gameplay/test/script-scoped-dt.test.ts
```

Attendu : les six tests qui construisent `ScriptManager` à la main passent toujours (le fallback les couvre). **S'arrêter** — l'humain commit.

---

### Task 5: `AnimatorSystem` obéit au périmètre

**Files:**
- Modify: `packages/gameplay/src/systems/AnimatorSystem.ts`
- Modify: `packages/gameplay/src/GameplayPlugin.ts` (construction de `AnimatorSystem`)
- Test: `packages/gameplay/test/animator-time-scale.test.ts`

**Interfaces:**
- Consumes: `TimeScaleManager.scaleOf`.
- Produces: `new AnimatorSystem(timeScale?: TimeScaleManager)` — le paramètre est optionnel pour ne pas casser `animator-system.test.ts:60`, qui construit `new AnimatorSystem()`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `packages/gameplay/test/animator-time-scale.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { Bound } from "@atlasjs/math";
import { Entity } from "@atlasjs/nexus";
import { Frame, SpriteAnimation } from "@atlasjs/nebula";

import { Animator, Sprite, SpriteRender, Transform2D } from "../src";
import { TIME_SCALE_MANAGER, TimeScaleManager } from "../src/time";
import { createHarness, Harness } from "./helpers/harness";
import { fakeTexture } from "./helpers/fakes";

type Clip = { clip: SpriteAnimation; frames: Frame[] };

function twoFrameClip(): Clip {
  const texture = fakeTexture("sheet", 64, 32);
  const frames: Frame[] = [
    new Frame(texture, new Bound(0, 0, 16, 32)),
    new Frame(texture, new Bound(16, 0, 16, 32)),
  ];
  return {
    clip: new SpriteAnimation({ frames, fps: 10, loop: true, autoPlay: true }),
    frames,
  };
}

describe("AnimatorSystem and TimeScale", () => {
  it("advances the animation at the raw dt with no scale", async () => {
    const harness: Harness = await createHarness();
    const texture = fakeTexture("sheet", 64, 32);
    const { clip, frames }: Clip = twoFrameClip();

    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, Transform2D);
    harness.world.addComponent(entity, SpriteRender, new Sprite(texture));
    harness.world.addComponent(entity, Animator, { walk: clip }, "walk");

    harness.frame();

    const animator = harness.world.getComponent(entity, Animator) as Animator;
    expect(animator.currentFrame()).toBe(frames[1]);
  });

  it("does not advance the animation of a frozen entity", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const texture = fakeTexture("sheet", 64, 32);
    const { clip, frames }: Clip = twoFrameClip();

    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, Transform2D);
    harness.world.addComponent(entity, SpriteRender, new Sprite(texture));
    harness.world.addComponent(entity, Animator, { walk: clip }, "walk");

    manager.setScale(entity, 0);

    harness.frame();
    harness.frame();

    const animator = harness.world.getComponent(entity, Animator) as Animator;
    expect(animator.currentFrame()).toBe(frames[0]);
  });

  it("freezes a child's animation through its parent's scale", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const texture = fakeTexture("sheet", 64, 32);
    const { clip, frames }: Clip = twoFrameClip();

    const root: Entity = harness.world.createEntity();
    const child: Entity = harness.world.createEntity();
    harness.world.setParent(child, root);

    harness.world.addComponent(child, Transform2D);
    harness.world.addComponent(child, SpriteRender, new Sprite(texture));
    harness.world.addComponent(child, Animator, { walk: clip }, "walk");

    manager.setScale(root, 0);

    harness.frame();
    harness.frame();

    const animator = harness.world.getComponent(child, Animator) as Animator;
    expect(animator.currentFrame()).toBe(frames[0]);
  });
});
```

> `SpriteAnimation.frames` est **privé** (`packages/nebula/src/animations/SpriteAnimation.ts:7`) : le helper garde donc une référence locale sur le tableau qu'il a construit, et les assertions comparent l'identité des `Frame`.

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
pnpm --filter @atlasjs/gameplay exec vitest run test/animator-time-scale.test.ts
```

Attendu : les 2e et 3e tests ÉCHOUENT — l'animation avance malgré l'échelle à 0.

- [ ] **Step 3: Injecter le manager dans le système**

Réécrire `packages/gameplay/src/systems/AnimatorSystem.ts` :

```ts
import { Frame } from "@atlasjs/nebula";
import { Entity, NexusSystem, NexusSystemContext } from "@atlasjs/nexus";

import { Sprite } from "@atlasjs/nebula";
import { Animator, SpriteRender } from "../components";
import type { TimeScaleManager } from "../time";

export class AnimatorSystem implements NexusSystem {
  private readonly spriteCache: Map<Frame, Sprite>;
  private readonly timeScale: TimeScaleManager | undefined;

  public constructor(timeScale?: TimeScaleManager) {
    this.spriteCache = new Map<Frame, Sprite>();
    this.timeScale = timeScale;
  }

  // prettier-ignore
  public update({ world, dt }: NexusSystemContext): void {
    world.query(Animator, SpriteRender).each((entity: Entity, animator: Animator, spriteRender: SpriteRender) => {
      animator.tick(dt * this.scaleFor(entity) * 1000);

      const frame: Frame | null = animator.currentFrame();
      if (frame === null) return;

      const sprite: Sprite = this.spriteFor(frame);
      if (spriteRender.sprite !== sprite) {
        spriteRender.sprite = sprite;
      }
    });
  }

  private scaleFor(entity: Entity): number {
    return this.timeScale === undefined ? 1 : this.timeScale.scaleOf(entity);
  }

  private spriteFor(frame: Frame): Sprite {
    let sprite: Sprite | undefined = this.spriteCache.get(frame);

    if (sprite === undefined) {
      sprite = new Sprite(frame.texture, {
        rect: frame.rect,
        pivot: frame.pivot,
      });
      this.spriteCache.set(frame, sprite);
    }

    return sprite;
  }
}
```

Dans `packages/gameplay/src/GameplayPlugin.ts` :

```ts
const animatorSystem: AnimatorSystem = new AnimatorSystem(timeScaleManager);
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

```bash
pnpm --filter @atlasjs/gameplay exec vitest run test/animator-time-scale.test.ts
```

Attendu : 3 tests PASS.

- [ ] **Step 5: Vérifier que le shake de caméra reste hors périmètre**

```bash
pnpm --filter @atlasjs/gameplay exec vitest run test/camera-shake.test.ts test/camera-sync-system.test.ts
```

Attendu : PASS sans modification — `CameraSyncSystem` n'a pas été touché, c'est le contrôle.

- [ ] **Step 6: Vérifier et rendre la main**

```bash
pnpm --filter @atlasjs/gameplay test
pnpm --filter @atlasjs/gameplay typecheck
pnpm --filter @atlasjs/gameplay build
pnpm exec prettier --write packages/gameplay/src/systems/AnimatorSystem.ts packages/gameplay/src/GameplayPlugin.ts packages/gameplay/test/animator-time-scale.test.ts
```

Le `build` est requis ici : l'API publique du package a changé (`TimeScale`, `TIME_SCALE_MANAGER`, `TimeApi`), et la Task 6 la consomme depuis `apps/dino-brawl`. **S'arrêter** — l'humain commit.

---

### Task 6: Migration de `dino-brawl` — les deux hitstops disparaissent

**Files:**
- Modify: `apps/dino-brawl/src/game/scripts/combat/MeleeHitResolver.ts:39-66`
- Modify: `apps/dino-brawl/src/game/scripts/weapon/SwordScript.ts` (champ `hitstopRemaining`, `updateAttackingState`, `onCreate`)
- Modify: `apps/dino-brawl/src/game/scripts/combat/HurtReactionScript.ts:58,78-104,123-127`
- Modify: `apps/dino-brawl/src/game/content/weapons/defaultSwordCombo.ts` (rendre le hitstop observable)
- Test: `apps/dino-brawl/test/game/scripts/combat/meleeHitResolver.test.ts`
- Test: `apps/dino-brawl/test/game/scripts/combat/hurtReactionScript.test.ts`
- Test: `apps/dino-brawl/test/game/scripts/weapon/swordScript.test.ts`

**Interfaces:**
- Consumes: `TimeApi.freeze(seconds, ...entities)`, `TimeApi.scaleOf(entity)` du package reconstruit.
- Produces: `MeleeHitResolver.lastStruck: readonly Entity[]` — les entités touchées par le dernier `resolve()`.

- [ ] **Step 1: Écrire le test qui échoue sur le résolveur**

Ajouter un `describe` à la fin de `apps/dino-brawl/test/game/scripts/combat/meleeHitResolver.test.ts`, en réutilisant les fabriques `createRig` et `createTarget` que le fichier porte déjà (ne pas en écrire de nouvelles — c'est la duplication que [[APP-11-player-spec-fakes-duplicated]] reproche à ce dossier) :

```ts
describe("MeleeHitResolver.lastStruck", () => {
  it("lists the entities hit by the last resolve", () => {
    const rig: Rig = createRig();

    rig.hitbox.setTargets([
      createTarget(7, new HurtboxScript()),
      createTarget(9, new HurtboxScript()),
    ]);

    expect(rig.resolve()).toBe(true);
    expect([...rig.resolver.lastStruck]).toEqual([7, 9]);
  });

  it("empties when a resolve hits nothing", () => {
    const rig: Rig = createRig();

    rig.hitbox.setTargets([createTarget(7, new HurtboxScript())]);
    rig.resolve();
    rig.resolve();

    expect(rig.resolver.lastStruck.length).toBe(0);
  });

  it("does not count a target that dodged the hit", () => {
    const rig: Rig = createRig();
    const immune: HurtboxScript = createInvincibleHurtbox(10);

    immune.takeHit({ direction: new Vec2(1, 0) });
    rig.hitbox.setTargets([createTarget(7, immune)]);

    rig.resolve();

    expect(rig.resolver.lastStruck.length).toBe(0);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
pnpm --filter dino-brawl exec vitest run test/game/scripts/combat/meleeHitResolver.test.ts
```

Attendu : ÉCHEC — `rig.resolver.lastStruck is undefined`.

- [ ] **Step 3: Exposer les victimes**

Dans `apps/dino-brawl/src/game/scripts/combat/MeleeHitResolver.ts`, ajouter le champ et le vider à chaque `resolve` :

```ts
  private readonly struckThisResolve: Entity[] = [];

  public get lastStruck(): readonly Entity[] {
    return this.struckThisResolve;
  }
```

Dans `resolve`, juste après `let landed: boolean = false;` :

```ts
    this.struckThisResolve.length = 0;
```

et dans la branche `if (hurtbox.takeHit(this.hit))`, après `this.struck.add(target.id);` :

```ts
      this.struckThisResolve.push(target.id);
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

```bash
pnpm --filter dino-brawl exec vitest run test/game/scripts/combat/meleeHitResolver.test.ts
```

Attendu : 3 nouveaux tests PASS, les 15 existants toujours verts.

- [ ] **Step 5: Remplacer le hitstop de l'attaquant**

Dans `apps/dino-brawl/src/game/scripts/weapon/SwordScript.ts` :

1. Ajouter l'import du service (valeur, pas type — `TimeApi` est une classe utilisée à l'exécution) :

```ts
import { TimeApi } from "@atlasjs/gameplay";
```

2. Supprimer le champ `private hitstopRemaining: number;` et son initialisation dans `onCreate`. **Conserver** `frozenAimAngle`.

3. Ajouter le champ et sa résolution dans `onCreate` :

```ts
  private time: TimeApi;
```

```ts
    this.time = this.getService(TimeApi);
```

4. Réécrire `updateAttackingState` :

```ts
  // prettier-ignore
  private updateAttackingState(dt: number): void {
    if (this.time.scaleOf(this.entityId) === 0) {
      this.applyAttackPose(this.frozenAimAngle);
      return;
    }

    this.attackClock += dt;
    this.attack.advance(this.attackClock);

    if (this.attack.rearmsHits) {
      this.armResolver();
    }

    this.attack.sample(this.attackClock, this.pose);

    const aimAngle: number = this.getAimAngle();

    this.blowDirection.set(Math.cos(aimAngle), Math.sin(aimAngle));

    if (this.getResolver().resolve(this.blowDirection)) {
      this.frozenAimAngle = aimAngle;
      this.camera.shake(this.shake, this.blowDirection);
      this.applyHitstop();
    }

    this.applyAttackPose(aimAngle);

    if (this.attackClock >= this.attackDuration) {
      this.state = "idle";
      this.trail.emitting = false;
    }
  }

  private applyHitstop(): void {
    const seconds: number = this.attack.impactHitstop ?? this.hitstopDuration;

    if (seconds <= 0) {
      return;
    }

    this.time.freeze(seconds, this.entityId, ...this.getResolver().lastStruck);
  }
```

> L'ordre compte : `camera.shake` **avant** `applyHitstop`. Le gel ne touche pas la caméra, mais garder le déclenchement du shake hors du chemin gelé rend l'indépendance lisible.

> `this.time.scaleOf(this.entityId) === 0` remplace le compteur : c'est le moteur qui tient désormais la durée. La pose reste figée à l'angle mémorisé parce que l'angle de visée, dérivé de la souris, **n'est pas gelé par une échelle de temps**.

- [ ] **Step 6: Supprimer le hitstop de la victime**

Dans `apps/dino-brawl/src/game/scripts/combat/HurtReactionScript.ts` :

1. Supprimer le champ `private hitstopRemaining: number = 0;` et son initialisation dans `onCreate`.
2. Supprimer la méthode `advanceHitstop` entière.
3. Réécrire `onUpdate` :

```ts
  public onUpdate(dt: number): void {
    if (this.hurtbox.hitCount !== this.lastHitCount) {
      this.lastHitCount = this.hurtbox.hitCount;
      this.onHit();
    }

    this.advanceKnockback(dt);
  }
```

4. Dans `onHit`, supprimer les trois dernières lignes (`this.hitstopRemaining = …`, le `if`, et `this.animator.pause()`). L'`Animator` est désormais gelé par le périmètre.

> Le gel de la victime est posé par l'attaquant, dans le même appel `freeze` que le sien. `HurtReactionScript` n'a plus rien à décompter : quand son entité est gelée, son `dt` vaut 0 et `advanceKnockback` n'avance pas.

- [ ] **Step 7: Rendre le hitstop observable**

Dans `apps/dino-brawl/src/game/content/weapons/defaultSwordCombo.ts`, ajouter `hitstop: 0.08` aux trois maillons du combo (lignes ~26-32). Sans ça, `impactHitstop` reste `undefined`, le repli `hitstopDuration` vaut 0, et **rien du travail des tâches 1 à 6 n'est visible à l'écran**.

- [ ] **Step 8: Mettre à jour les tests de l'app**

Dans `apps/dino-brawl/test/game/scripts/combat/hurtReactionScript.test.ts` : supprimer les cas qui assertent `animator.paused` pendant le hitstop et l'injection de `hitstopRemaining`. Remplacer par un cas qui vérifie que le knockback n'avance pas quand `onUpdate` reçoit `dt === 0` :

```ts
it("does not advance the knockback on a zero dt", () => {
  const rig: Rig = createRig();

  rig.hit(100, 0.1);
  rig.frame(0);

  expect(rig.character.moves.length).toBe(0);
});
```

Dans `apps/dino-brawl/test/game/scripts/weapon/swordScript.test.ts` : **attention**, ce fichier n'utilise `createScriptHarness` que pour fabriquer des `HurtboxScript` — le `SwordScript`, lui, est construit par `new SwordScript()` et ses champs privés sont injectés à la main dans `createRig` (`injected.input`, `injected.camera`, …), sans jamais appeler `onCreate`. Le faux `TimeApi` s'injecte donc **de la même façon**, pas par une table de services.

Ajouter le faux en tête de fichier, à côté de `FakeHitbox` :

```ts
class FakeTimeApi {
  public readonly freezes: { seconds: number; entities: unknown[] }[] = [];

  public frozen: boolean = false;

  public scaleOf(): number {
    return this.frozen ? 0 : 1;
  }

  public freeze(seconds: number, ...entities: unknown[]): void {
    this.freezes.push({ seconds, entities });
  }
}
```

Dans `createRig` : ajouter `time` au type `Rig`, instancier le faux, l'injecter, et **supprimer** la ligne `injected.hitstopRemaining = 0;` :

```ts
  const time: FakeTimeApi = new FakeTimeApi();
  injected.time = time;
```

Ajouter le cas qui verrouille le gel simultané :

```ts
describe("SwordScript hitstop", () => {
  it("freezes the attacker and its victim in the same call", () => {
    const rig: Rig = createRig();

    (rig.sword as unknown as { attack: FakeAttack }).attack.hitstopOverride = 0.12;
    rig.hitbox.setTargets([createTarget(42, new HurtboxScript())]);

    rig.frame();

    expect(rig.time.freezes).toHaveLength(1);
    expect(rig.time.freezes[0].seconds).toBe(0.12);
    expect(rig.time.freezes[0].entities).toHaveLength(2);
  });

  it("freezes nothing when the attack declares no hitstop", () => {
    const rig: Rig = createRig({ hitstopDuration: 0 });

    rig.hitbox.setTargets([createTarget(42, new HurtboxScript())]);
    rig.frame();

    expect(rig.time.freezes).toHaveLength(0);
  });

  it("locks the pose to the memorized angle during the freeze", () => {
    const rig: Rig = createRig();
    const attack: FakeAttack = (rig.sword as unknown as { attack: FakeAttack }).attack;

    rig.time.frozen = true;
    const before: number = attack.advanceCalls.length;

    rig.frame();

    expect(attack.advanceCalls.length).toBe(before);
  });
});
```

> `entityId` est lu par `applyHitstop` via `this.entityId`, qui traverse `this.context` — non lié dans ce rig. Injecter aussi `injected.__context = { getEntityId: () => 1 } ;` **ou**, plus propre, stocker l'identifiant dans un champ résolu en `onCreate`. Vérifier ce que fait `SwordScript` au moment de l'implémentation et choisir : si l'accès à `this.entityId` lève dans le rig, préférer un champ `private selfId: Entity` posé en `onCreate` et injecté par le test.

- [ ] **Step 9: Lancer les tests de l'app**

```bash
pnpm --filter dino-brawl test
pnpm --filter dino-brawl exec tsc --noEmit -p tsconfig.app.json
```

Attendu : suite verte, type-check sans erreur.

- [ ] **Step 10: Vérification navigateur**

Invoquer la skill `atlas-verify-webgpu` et suivre son protocole. À observer :

1. Frapper un ennemi. L'attaquant (joueur + épée) **et** la victime se figent brièvement ensemble.
2. Le shake de caméra **continue** pendant ce gel.
3. L'animation de la victime est figée pendant le gel puis reprend, sans appel manuel à `pause`/`resume`.
4. Enchaîner deux coups rapidement : le combo passe bien au deuxième maillon (contrôle d'APP-15).

Prendre une capture d'écran au moment du gel et la joindre au rapport.

- [ ] **Step 11: Prettier et rendre la main**

```bash
pnpm exec prettier --write apps/dino-brawl/src/game/scripts/combat/MeleeHitResolver.ts apps/dino-brawl/src/game/scripts/combat/HurtReactionScript.ts apps/dino-brawl/src/game/scripts/weapon/SwordScript.ts apps/dino-brawl/src/game/content/weapons/defaultSwordCombo.ts apps/dino-brawl/test/game/scripts/combat/meleeHitResolver.test.ts apps/dino-brawl/test/game/scripts/combat/hurtReactionScript.test.ts apps/dino-brawl/test/game/scripts/weapon/swordScript.test.ts
```

**S'arrêter** — l'humain commit. **GAMEPLAY-97 est livré à ce point.**

---

# Partie B — GAMEPLAY-96 : timers de script

---

### Task 7: Les primitives de timer, en isolation

**Files:**
- Create: `packages/gameplay/src/scripting/timers/types.ts`
- Create: `packages/gameplay/src/scripting/timers/timers.ts`
- Create: `packages/gameplay/src/scripting/timers/index.ts`
- Modify: `packages/gameplay/src/scripting/index.ts`
- Test: `packages/gameplay/test/timers-unit.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `interface TimerHandle {}` (marqueur), `interface AdvancingTimer extends TimerHandle { advance(dt: number): void }`
  - `interface Stopwatch extends TimerHandle { readonly elapsed: number; reset(): void }`
  - `interface Countdown extends TimerHandle { readonly remaining: number; readonly elapsed: number; readonly done: boolean; reset(seconds?: number): void }`
  - `interface Repeater extends TimerHandle { interval: number; reset(): void }`
  - `class StopwatchTimer implements Stopwatch, AdvancingTimer`
  - `class CountdownTimer implements Countdown, AdvancingTimer` — `constructor(seconds: number)`
  - `class RepeaterTimer implements Repeater, AdvancingTimer` — `constructor(seconds: number, callback: () => void)`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `packages/gameplay/test/timers-unit.test.ts` :

```ts
import { describe, expect, it } from "vitest";

import {
  CountdownTimer,
  RepeaterTimer,
  StopwatchTimer,
} from "../src/scripting/timers";

describe("StopwatchTimer", () => {
  it("accumulates time", () => {
    const timer: StopwatchTimer = new StopwatchTimer();

    timer.advance(0.1);
    timer.advance(0.2);

    expect(timer.elapsed).toBeCloseTo(0.3);
  });

  it("restarts from zero after reset", () => {
    const timer: StopwatchTimer = new StopwatchTimer();

    timer.advance(0.5);
    timer.reset();

    expect(timer.elapsed).toBe(0);
  });

  it("does not advance on a zero dt", () => {
    const timer: StopwatchTimer = new StopwatchTimer();

    timer.advance(0);

    expect(timer.elapsed).toBe(0);
  });
});

describe("CountdownTimer", () => {
  it("counts down and declares itself done at zero", () => {
    const timer: CountdownTimer = new CountdownTimer(0.3);

    expect(timer.done).toBe(false);

    timer.advance(0.2);
    expect(timer.remaining).toBeCloseTo(0.1);
    expect(timer.done).toBe(false);

    timer.advance(0.2);
    expect(timer.done).toBe(true);
  });

  it("does not go below zero", () => {
    const timer: CountdownTimer = new CountdownTimer(0.1);

    timer.advance(10);

    expect(timer.remaining).toBe(0);
  });

  it("exposes the time elapsed since the last reset", () => {
    const timer: CountdownTimer = new CountdownTimer(0.5);

    timer.advance(0.2);

    expect(timer.elapsed).toBeCloseTo(0.2);
  });

  it("reset with no argument resumes the original duration", () => {
    const timer: CountdownTimer = new CountdownTimer(0.5);

    timer.advance(10);
    timer.reset();

    expect(timer.remaining).toBe(0.5);
    expect(timer.done).toBe(false);
  });

  it("reset with an argument changes the duration", () => {
    const timer: CountdownTimer = new CountdownTimer(0.5);

    timer.reset(0.2);

    expect(timer.remaining).toBe(0.2);
  });

  it("a countdown created at zero is done immediately", () => {
    const timer: CountdownTimer = new CountdownTimer(0);

    expect(timer.done).toBe(true);
  });
});

describe("RepeaterTimer", () => {
  it("triggers the callback when the interval is reached", () => {
    let fired: number = 0;
    const timer: RepeaterTimer = new RepeaterTimer(0.1, () => {
      fired += 1;
    });

    timer.advance(0.05);
    expect(fired).toBe(0);

    timer.advance(0.06);
    expect(fired).toBe(1);
  });

  it("fires only once per advance, even on a long frame", () => {
    let fired: number = 0;
    const timer: RepeaterTimer = new RepeaterTimer(0.1, () => {
      fired += 1;
    });

    timer.advance(5);

    expect(fired).toBe(1);
  });

  it("keeps the remainder without letting it exceed one interval", () => {
    let fired: number = 0;
    const timer: RepeaterTimer = new RepeaterTimer(0.1, () => {
      fired += 1;
    });

    timer.advance(0.15);
    expect(fired).toBe(1);

    timer.advance(0.05);
    expect(fired).toBe(2);
  });

  it("picks up an interval changed on the fly", () => {
    let fired: number = 0;
    const timer: RepeaterTimer = new RepeaterTimer(1, () => {
      fired += 1;
    });

    timer.advance(0.2);
    timer.interval = 0.1;
    timer.advance(0);

    expect(fired).toBe(1);
  });

  it("reset puts the clock back to zero without firing", () => {
    let fired: number = 0;
    const timer: RepeaterTimer = new RepeaterTimer(0.1, () => {
      fired += 1;
    });

    timer.advance(0.09);
    timer.reset();
    timer.advance(0.05);

    expect(fired).toBe(0);
  });

  it("a zero or negative interval never fires", () => {
    let fired: number = 0;
    const timer: RepeaterTimer = new RepeaterTimer(0, () => {
      fired += 1;
    });

    timer.advance(1);

    expect(fired).toBe(0);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
pnpm --filter @atlasjs/gameplay exec vitest run test/timers-unit.test.ts
```

Attendu : ÉCHEC — `Cannot find module '../src/scripting/timers'`.

- [ ] **Step 3: Écrire les types**

`packages/gameplay/src/scripting/timers/types.ts` :

```ts
export interface TimerHandle {
  reset(): void;
}

export interface AdvancingTimer extends TimerHandle {
  advance(dt: number): void;
}

export interface Stopwatch extends TimerHandle {
  readonly elapsed: number;
}

export interface Countdown extends TimerHandle {
  readonly remaining: number;
  readonly elapsed: number;
  readonly done: boolean;
  reset(seconds?: number): void;
}

export interface Repeater extends TimerHandle {
  interval: number;
}
```

- [ ] **Step 4: Écrire les implémentations**

`packages/gameplay/src/scripting/timers/timers.ts` :

```ts
import { AdvancingTimer, Countdown, Repeater, Stopwatch } from "./types";

export class StopwatchTimer implements Stopwatch, AdvancingTimer {
  private accumulated: number = 0;

  public get elapsed(): number {
    return this.accumulated;
  }

  public advance(dt: number): void {
    this.accumulated += dt;
  }

  public reset(): void {
    this.accumulated = 0;
  }
}

export class CountdownTimer implements Countdown, AdvancingTimer {
  private readonly initial: number;

  private left: number;
  private spent: number;

  public constructor(seconds: number) {
    this.initial = Math.max(0, seconds);
    this.left = this.initial;
    this.spent = 0;
  }

  public get remaining(): number {
    return this.left;
  }

  public get elapsed(): number {
    return this.spent;
  }

  public get done(): boolean {
    return this.left <= 0;
  }

  public advance(dt: number): void {
    this.spent += dt;
    this.left = Math.max(0, this.left - dt);
  }

  public reset(seconds?: number): void {
    this.left = seconds === undefined ? this.initial : Math.max(0, seconds);
    this.spent = 0;
  }
}

export class RepeaterTimer implements Repeater, AdvancingTimer {
  private readonly callback: () => void;

  private accumulated: number = 0;

  public interval: number;

  public constructor(seconds: number, callback: () => void) {
    this.interval = seconds;
    this.callback = callback;
  }

  public advance(dt: number): void {
    this.accumulated += dt;

    if (this.interval <= 0 || this.accumulated < this.interval) {
      return;
    }

    this.accumulated = Math.min(this.accumulated - this.interval, this.interval);
    this.callback();
  }

  public reset(): void {
    this.accumulated = 0;
  }
}
```

`packages/gameplay/src/scripting/timers/index.ts` :

```ts
export * from "./timers";
export * from "./types";
```

Ajouter dans `packages/gameplay/src/scripting/index.ts` :

```ts
export * from "./timers";
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

```bash
pnpm --filter @atlasjs/gameplay exec vitest run test/timers-unit.test.ts
```

Attendu : 16 tests PASS.

- [ ] **Step 6: Vérifier et rendre la main**

```bash
pnpm --filter @atlasjs/gameplay test
pnpm --filter @atlasjs/gameplay typecheck
pnpm exec prettier --write packages/gameplay/src/scripting/timers/types.ts packages/gameplay/src/scripting/timers/timers.ts packages/gameplay/src/scripting/timers/index.ts packages/gameplay/src/scripting/index.ts packages/gameplay/test/timers-unit.test.ts
```

**S'arrêter** — l'humain commit.

---

### Task 8: Brancher les timers sur le cycle de vie des scripts

**Files:**
- Modify: `packages/gameplay/src/scripting/core/ScriptContext.ts`
- Modify: `packages/gameplay/src/scripting/core/AtlasScript.ts`
- Modify: `packages/gameplay/src/scripting/core/core-types.ts`
- Modify: `packages/gameplay/src/scripting/runtime/RuntimeScriptContext.ts`
- Modify: `packages/gameplay/src/scripting/runtime/ScriptManager.ts:72-102` (record) et `:131-135` (`update`) et `:384-417` (`tearDownScript`)
- Modify: `packages/gameplay/src/testing/StubScriptContext.ts`
- Modify: `packages/gameplay/src/testing/createScriptHarness.ts`
- Test: `packages/gameplay/test/script-timers.test.ts`

**Interfaces:**
- Consumes: `StopwatchTimer`, `CountdownTimer`, `RepeaterTimer`, `AdvancingTimer`, `TimerHandle` de la Task 7 ; `TimeScaleManager.scaleOf` via `ScriptManager.scaleFor` de la Task 4.
- Produces:
  - `ScriptContext.stopwatch(): Stopwatch`, `.countdown(seconds: number): Countdown`, `.every(seconds: number, callback: () => void): Repeater`, `.cancel(handle: TimerHandle): void`, `.advanceTimers(dt: number): void`
  - `AtlasScript` : les mêmes quatre en `protected` (sans `advanceTimers`)
  - `ScriptInstanceRecord.context: ScriptContext`
  - `ScriptHarness.advance(dt: number): void`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `packages/gameplay/test/script-timers.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import { AtlasScript, Countdown, Repeater, Stopwatch } from "../src/scripting";
import { TIME_SCALE_MANAGER, TimeScaleManager } from "../src/time";
import { createHarness, Harness } from "./helpers/harness";

class TimerProbe extends AtlasScript {
  public watch: Stopwatch;
  public down: Countdown;
  public repeat: Repeater;
  public ticks: number = 0;
  public elapsedAtUpdate: number[] = [];

  public onCreate(): void {
    this.watch = this.stopwatch();
    this.down = this.countdown(0.2);
    this.repeat = this.every(0.2, () => {
      this.ticks += 1;
    });
  }

  public onUpdate(): void {
    this.elapsedAtUpdate.push(this.watch.elapsed);
  }
}

class ThrowingRepeater extends AtlasScript {
  public onCreate(): void {
    this.every(0.05, () => {
      throw new Error("boom");
    });
  }
}

describe("script timers", () => {
  it("advances the stopwatch with the frame's dt", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    const probe: TimerProbe = harness.scripts.attach(entity, TimerProbe);

    harness.frame();

    expect(probe.watch.elapsed).toBeCloseTo(0.15);
  });

  it("advances the timers BEFORE onUpdate", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    const probe: TimerProbe = harness.scripts.attach(entity, TimerProbe);

    harness.frame();

    expect(probe.elapsedAtUpdate[0]).toBeCloseTo(0.15);
  });

  it("counts down the countdown and declares it done", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    const probe: TimerProbe = harness.scripts.attach(entity, TimerProbe);

    harness.frame();
    expect(probe.down.done).toBe(false);

    harness.frame();
    expect(probe.down.done).toBe(true);
  });

  it("triggers the repeater", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    const probe: TimerProbe = harness.scripts.attach(entity, TimerProbe);

    harness.frame();
    harness.frame();

    expect(probe.ticks).toBe(1);
  });

  it("freezes the timers of a frozen entity", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    const probe: TimerProbe = harness.scripts.attach(entity, TimerProbe);

    harness.frame();
    manager.setScale(entity, 0);
    harness.frame();
    harness.frame();

    expect(probe.watch.elapsed).toBeCloseTo(0.15);
  });

  it("cancel stops a timer's advance", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    const probe: TimerProbe = harness.scripts.attach(entity, TimerProbe);

    harness.frame();
    const frozen: number = probe.watch.elapsed;

    (probe as unknown as { cancel: (h: Stopwatch) => void }).cancel(probe.watch);
    harness.frame();

    expect(probe.watch.elapsed).toBeCloseTo(frozen);
  });

  it("quarantines the script when a repeater callback throws", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    const probe: ThrowingRepeater = harness.scripts.attach(
      entity,
      ThrowingRepeater,
    );

    harness.frame();

    expect(harness.scripts.isEnabled(probe)).toBe(false);
  });

  it("stops advancing the timers of a destroyed script", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    const probe: TimerProbe = harness.scripts.attach(entity, TimerProbe);

    harness.frame();
    const frozen: number = probe.watch.elapsed;

    harness.world.destroyEntity(entity);
    harness.frame();

    expect(probe.watch.elapsed).toBeCloseTo(frozen);
  });
});
```

> Si `world.destroyEntity` porte un autre nom, le retrouver dans `packages/gameplay/test/script-leak-on-destroy.test.ts`, qui détruit déjà une entité scriptée.

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
pnpm --filter @atlasjs/gameplay exec vitest run test/script-timers.test.ts
```

Attendu : ÉCHEC de compilation — `this.stopwatch is not a function`.

- [ ] **Step 3: Étendre `ScriptContext`**

Dans `packages/gameplay/src/scripting/core/ScriptContext.ts`, ajouter les imports et les membres :

```ts
import type {
  Countdown,
  Repeater,
  Stopwatch,
  TimerHandle,
} from "../timers";
```

```ts
  stopwatch(): Stopwatch;
  countdown(seconds: number): Countdown;
  every(seconds: number, callback: () => void): Repeater;
  cancel(handle: TimerHandle): void;
  advanceTimers(dt: number): void;
```

- [ ] **Step 4: Implémenter dans `RuntimeScriptContext`**

Dans `packages/gameplay/src/scripting/runtime/RuntimeScriptContext.ts`, ajouter l'import :

```ts
import {
  type AdvancingTimer,
  type Countdown,
  type Repeater,
  type Stopwatch,
  type TimerHandle,
  CountdownTimer,
  RepeaterTimer,
  StopwatchTimer,
} from "../timers";
```

Ajouter le champ `private readonly timers: AdvancingTimer[];`, l'initialiser à `[]` dans le constructeur, et ajouter les méthodes :

```ts
  public stopwatch(): Stopwatch {
    const timer: StopwatchTimer = new StopwatchTimer();
    this.timers.push(timer);
    return timer;
  }

  public countdown(seconds: number): Countdown {
    const timer: CountdownTimer = new CountdownTimer(seconds);
    this.timers.push(timer);
    return timer;
  }

  public every(seconds: number, callback: () => void): Repeater {
    const timer: RepeaterTimer = new RepeaterTimer(seconds, callback);
    this.timers.push(timer);
    return timer;
  }

  public cancel(handle: TimerHandle): void {
    const index: number = this.timers.indexOf(handle as AdvancingTimer);

    if (index >= 0) {
      this.timers.splice(index, 1);
    }
  }

  public advanceTimers(dt: number): void {
    for (let i: number = 0; i < this.timers.length; i++) {
      this.timers[i].advance(dt);
    }
  }
```

- [ ] **Step 5: Exposer les primitives sur `AtlasScript`**

Dans `packages/gameplay/src/scripting/core/AtlasScript.ts`, ajouter l'import :

```ts
import type { Countdown, Repeater, Stopwatch, TimerHandle } from "../timers";
```

puis les quatre méthodes `protected`, après `destroy()` :

```ts
  protected stopwatch(): Stopwatch {
    return this.context.stopwatch();
  }

  protected countdown(seconds: number): Countdown {
    return this.context.countdown(seconds);
  }

  protected every(seconds: number, callback: () => void): Repeater {
    return this.context.every(seconds, callback);
  }

  protected cancel(handle: TimerHandle): void {
    this.context.cancel(handle);
  }
```

> `context` lève si le script n'est pas lié au runtime. C'est le comportement voulu : un timer n'a pas de sens hors runtime.

- [ ] **Step 6: Faire avancer les timers depuis `ScriptManager`**

Dans `packages/gameplay/src/scripting/core/core-types.ts`, ajouter au type `ScriptInstanceRecord` :

```ts
  context: ScriptContext;
```

avec l'import `import type { ScriptContext } from "./ScriptContext";`.

Dans `ScriptManager.attach`, ajouter `context,` au littéral du record.

Réécrire `ScriptManager.update` :

```ts
public update(dt: number): void {
  this.runLifecycle("onUpdate", (record: ScriptInstanceRecord): void => {
    const scaled: number = dt * this.scaleFor(record.entityId);

    record.context.advanceTimers(scaled);
    record.instance.onUpdate?.(scaled);
  });
}
```

> `advanceTimers` est **dans** le `invoke` de `runLifecycle`, donc couvert par son `try/catch` par script : un callback de `every` qui lève met le script en quarantaine, comme n'importe quelle autre phase.

Dans `tearDownScript`, le record est déjà retiré de `this.records` avant l'appel à `onDestroy` — les timers cessent donc d'avancer sans code supplémentaire. Aucune modification n'est nécessaire là ; le test de l'étape 1 le vérifie.

- [ ] **Step 7: Étendre le seam de test**

Dans `packages/gameplay/src/testing/StubScriptContext.ts`, ajouter exactement les mêmes cinq méthodes que `RuntimeScriptContext` (même code, mêmes imports), avec un champ `private readonly timers: AdvancingTimer[]` initialisé à `[]`.

Dans `packages/gameplay/src/testing/createScriptHarness.ts`, ajouter à `ScriptHarness` :

```ts
  advance(dt: number): void;
```

et à l'objet retourné :

```ts
    advance: (dt: number): void => {
      context.advanceTimers(dt);
      script.onUpdate?.(dt);
    },
```

- [ ] **Step 8: Lancer le test pour vérifier qu'il passe**

```bash
pnpm --filter @atlasjs/gameplay exec vitest run test/script-timers.test.ts
```

Attendu : 8 tests PASS.

- [ ] **Step 9: Vérifier et rendre la main**

```bash
pnpm --filter @atlasjs/gameplay test
pnpm --filter @atlasjs/gameplay typecheck
pnpm --filter @atlasjs/gameplay build
pnpm exec prettier --write packages/gameplay/src/scripting/core/ScriptContext.ts packages/gameplay/src/scripting/core/AtlasScript.ts packages/gameplay/src/scripting/core/core-types.ts packages/gameplay/src/scripting/runtime/RuntimeScriptContext.ts packages/gameplay/src/scripting/runtime/ScriptManager.ts packages/gameplay/src/testing/StubScriptContext.ts packages/gameplay/src/testing/createScriptHarness.ts packages/gameplay/test/script-timers.test.ts
```

Le `build` est requis : `apps/dino-brawl` consomme ces primitives à la tâche suivante. **S'arrêter** — l'humain commit.

---

### Task 9: Migration des sept horloges de `dino-brawl`

**Files:**
- Modify: `apps/dino-brawl/src/game/scripts/player/PlayerDashScript.ts:55,79,101-103,119,159`
- Modify: `apps/dino-brawl/src/game/scripts/combat/HurtboxScript.ts:25,50-56,60-66,70`
- Modify: `apps/dino-brawl/src/game/scripts/player/MovementEmitterScript.ts:33,38-56`
- Modify: `apps/dino-brawl/src/game/scripts/weapon/SwordScript.ts` (les deux horloges)
- Modify: `apps/dino-brawl/src/game/scripts/weapon/attacks/AttackChain.ts:15,70-72,84-90`
- Modify: `apps/dino-brawl/src/game/scripts/player/PlayerAnimationScript.ts:28,40,49,57` — **suppression**
- Test: `apps/dino-brawl/test/game/scripts/combat/hurtboxScript.test.ts` — **migrer vers `createScriptHarness`**
- Test: `apps/dino-brawl/test/game/scripts/weapon/attacks/attackChain.test.ts` — **migrer vers `createScriptHarness`**
- Test: `apps/dino-brawl/test/game/scripts/combat/meleeHitResolver.test.ts` — **11 `new HurtboxScript()` non liés à migrer**
- Test: `apps/dino-brawl/test/game/scripts/weapon/swordScript.test.ts` — faux chronomètres injectés dans `createRig`
- Test: `apps/dino-brawl/test/game/scripts/player/playerDashScript.test.ts`, `player/movementEmitter.test.ts`, `player/playerAnimationScript.test.ts` — déjà sur `createScriptHarness`, adapter aux nouveaux champs

**Interfaces:**
- Consumes: `Stopwatch`, `Countdown`, `Repeater` depuis `@atlasjs/gameplay` (imports de **type** — `import type`), et les méthodes `protected` de `AtlasScript`.
- Produces: rien de nouveau.

> **Pourquoi trois fichiers de test doivent migrer.** `hurtboxScript.test.ts`, `attackChain.test.ts` et `meleeHitResolver.test.ts` instancient le script avec `new X()` **sans lier de contexte**, puis injectent les champs privés à la main. Dès que ces scripts appellent `this.countdown(...)` ou `this.stopwatch(...)` dans `onCreate`, l'accès à `this.context` lève. `createScriptHarness` lie un `StubScriptContext` et fournit `advance(dt)` — c'est le chemin prévu.
>
> `meleeHitResolver.test.ts` est le plus exposé : il construit `new HurtboxScript()` **onze fois** et appelle `hurtbox.onUpdate(DT)` à la main pour faire retomber l'invincibilité. Après la migration de `HurtboxScript`, `takeHit` lit `this.invincibility.done` sur un champ jamais initialisé — `TypeError` sur chacun de ces onze sites. Le fichier porte déjà une fabrique correcte (`createInvincibleHurtbox`, qui passe par `createScriptHarness`) : la généraliser, et remplacer chaque `hurtbox.onUpdate(DT)` par l'`advance` du harness correspondant.
>
> `swordScript.test.ts` n'a pas ce problème pour le `SwordScript` lui-même — son `createRig` n'appelle jamais `onCreate` — mais il injecte `injected.clock = 0` et `injected.attackClock = 0`, deux nombres qui deviennent des `Stopwatch`.

- [ ] **Step 1: Écrire le test qui échoue pour `HurtboxScript`**

Réécrire `apps/dino-brawl/test/game/scripts/combat/hurtboxScript.test.ts` sur `createScriptHarness`. Cas minimum à conserver et à porter :

```ts
import { describe, expect, it } from "vitest";
import { Vec2 } from "@atlasjs/math";
import { createScriptHarness, type ScriptHarness } from "@atlasjs/gameplay/testing";

import { HurtboxScript } from "../../../../src/game/scripts/combat/HurtboxScript";

function rig(invincibilityDuration: number = 0): ScriptHarness<HurtboxScript> {
  const harness: ScriptHarness<HurtboxScript> = createScriptHarness(
    HurtboxScript,
    { props: { invincibilityDuration } },
  );
  harness.create();
  return harness;
}

describe("HurtboxScript", () => {
  it("refuses a second hit during invincibility", () => {
    const harness: ScriptHarness<HurtboxScript> = rig(0.5);

    expect(harness.script.takeHit({ direction: new Vec2(1, 0) })).toBe(true);
    expect(harness.script.takeHit({ direction: new Vec2(1, 0) })).toBe(false);
  });

  it("becomes vulnerable again after the duration", () => {
    const harness: ScriptHarness<HurtboxScript> = rig(0.5);

    harness.script.takeHit({ direction: new Vec2(1, 0) });
    harness.advance(0.6);

    expect(harness.script.isInvincible).toBe(false);
  });

  it("grantInvincibility never shortens an invincibility already in progress", () => {
    const harness: ScriptHarness<HurtboxScript> = rig(0.5);

    harness.script.takeHit({ direction: new Vec2(1, 0) });
    harness.script.grantInvincibility(0.1);
    harness.advance(0.2);

    expect(harness.script.isInvincible).toBe(true);
  });

  it("does not advance invincibility on a zero dt", () => {
    const harness: ScriptHarness<HurtboxScript> = rig(0.5);

    harness.script.takeHit({ direction: new Vec2(1, 0) });
    harness.advance(0);

    expect(harness.script.isInvincible).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
pnpm --filter dino-brawl exec vitest run test/game/scripts/combat/hurtboxScript.test.ts
```

Attendu : ÉCHEC — `harness.advance is not a function` **ou** les assertions d'invincibilité rouges (le script décompte encore à la main).

- [ ] **Step 3: Migrer `HurtboxScript` sur un `countdown`**

Dans `apps/dino-brawl/src/game/scripts/combat/HurtboxScript.ts` :

```ts
import type { Countdown } from "@atlasjs/gameplay";
```

Remplacer `private invincibilityRemaining: number = 0;` par :

```ts
  private invincibility: Countdown;
```

Ajouter un `onCreate` (le script n'en a pas aujourd'hui) :

```ts
  public onCreate(): void {
    this.invincibility = this.countdown(0);
  }
```

Remplacer `isInvincible` :

```ts
  public get isInvincible(): boolean {
    return !this.invincibility.done;
  }
```

Supprimer `onUpdate` entièrement — le countdown avance seul.

Réécrire `grantInvincibility` :

```ts
  public grantInvincibility(duration: number): void {
    if (duration > this.invincibility.remaining) {
      this.invincibility.reset(duration);
    }
  }
```

Dans `takeHit`, remplacer la garde et l'affectation :

```ts
    if (!this.invincibility.done) {
      return false;
    }

    this.invincibility.reset(this.invincibilityDuration);
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

```bash
pnpm --filter dino-brawl exec vitest run test/game/scripts/combat/hurtboxScript.test.ts
```

Attendu : 4 tests PASS.

- [ ] **Step 5: Migrer `PlayerDashScript`**

Dans `apps/dino-brawl/src/game/scripts/player/PlayerDashScript.ts` :

```ts
import type { Countdown, Stopwatch } from "@atlasjs/gameplay";
```

Remplacer les champs `private progress: number = 0;` et `private cooldownRemaining: number = 0;` par :

```ts
  private dashClock: Stopwatch;
  private cooldownTimer: Countdown;
```

Dans `onCreate`, remplacer `this.progress = 0;` et `this.cooldownRemaining = 0;` par :

```ts
    this.dashClock = this.stopwatch();
    this.cooldownTimer = this.countdown(0);
```

Ajouter le getter privé de progression :

```ts
  private get progress(): number {
    return Math.min(1, this.dashClock.elapsed / this.duration);
  }
```

Réécrire `onUpdate` :

```ts
  public onUpdate(dt: number): void {
    if (this.dashing && this.progress >= 1) {
      this.stop();
    }

    if (this.canStart()) {
      this.start();
    }

    if (this.dashing) {
      this.advance(dt);
    }
  }
```

Dans `canStart`, remplacer `this.cooldownRemaining <= 0` par `this.cooldownTimer.done`.

Dans `start`, remplacer `this.progress = 0;` par `this.dashClock.reset();` et `this.cooldownRemaining = this.cooldown;` par `this.cooldownTimer.reset(this.cooldown);`.

Réécrire `advance` — la progression est désormais lue, pas accumulée :

```ts
  /** Steps by the gap between this frame's covered distance and the last. */
  private advance(_dt: number): void {
    const covered: number = this.distance * this.curveAt(this.progress);
    const step: number = covered - this.travelled;

    this.travelled = covered;

    this.moveDelta.copyFrom(this.direction).mult(step);
    this.character.move(this.moveDelta);
  }
```

et son appelant devient `this.advance(dt)` inchangé.

> `advance` ne consomme plus `dt` : le `dashClock` a déjà été avancé par le runtime **avant** `onUpdate`. Si un paramètre inutilisé gêne le lint, supprimer le paramètre et l'argument à l'appel.

- [ ] **Step 6: Migrer `MovementEmitterScript`**

Dans `apps/dino-brawl/src/game/scripts/player/MovementEmitterScript.ts` :

```ts
import type { Repeater } from "@atlasjs/gameplay";
```

Remplacer le champ `clock` par :

```ts
  private emitter: Repeater;
```

Dans `onCreate`, remplacer `this.clock = 0;` par :

```ts
    this.emitter = this.every(this.walkInterval, () => this.emit());
```

Réécrire `onUpdate` :

```ts
  public onUpdate(): void {
    const v: Vec2 = this.move.readValue();

    if (v.mag() === 0) {
      this.emitter.reset();
      return;
    }

    this.emitter.interval = this.boost.isDown()
      ? this.runInterval
      : this.walkInterval;
  }
```

> Le repeater est avancé par le runtime **avant** `onUpdate`. Le script ne fait donc plus que choisir l'intervalle et remettre l'horloge à zéro à l'arrêt.

- [ ] **Step 7: Migrer les deux horloges de `SwordScript`**

Dans `apps/dino-brawl/src/game/scripts/weapon/SwordScript.ts` :

```ts
import type { Stopwatch } from "@atlasjs/gameplay";
```

Remplacer `private clock: number;` (flottement) et `private attackClock: number;` par :

```ts
  private floatClock: Stopwatch;
  private attackClock: Stopwatch;
```

Dans `onCreate`, remplacer `this.clock = 0;` et `this.attackClock = 0;` par :

```ts
    this.floatClock = this.stopwatch();
    this.attackClock = this.stopwatch();
```

Remplacer chaque lecture `this.clock` par `this.floatClock.elapsed` et chaque `this.attackClock` par `this.attackClock.elapsed`. Supprimer les incréments `this.clock += dt;` et `this.attackClock += dt;` — le runtime les avance.

Là où l'attaque démarre (`begin`, qui posait `this.attackClock = 0`), écrire `this.attackClock.reset();`.

> Vérification importante : dans `updateAttackingState`, la sortie anticipée pendant le gel doit rester **avant** toute lecture de `attackClock`. Comme le `dt` du script vaut 0 pendant le gel, le stopwatch n'avance pas de lui-même ; la garde `scaleOf(...) === 0` de la Task 6 reste néanmoins nécessaire pour figer l'angle de visée.

- [ ] **Step 8: Migrer `AttackChain`**

Dans `apps/dino-brawl/src/game/scripts/weapon/attacks/AttackChain.ts` :

```ts
import type { Stopwatch } from "@atlasjs/gameplay";
```

Remplacer `private elapsedSinceBegin: number = 0;` par :

```ts
  private sinceBegin: Stopwatch;
```

Ajouter un `onCreate` :

```ts
  public onCreate(): void {
    this.sinceBegin = this.stopwatch();
  }
```

> Si `WeaponAttack` définit déjà `onCreate`, appeler `super.onCreate?.()` en premier. Le vérifier avec `grep -n "onCreate" apps/dino-brawl/src/game/scripts/weapon/attacks/WeaponAttack.ts`.

Supprimer `onUpdate` entièrement. Dans `selectNextAttack`, remplacer `this.elapsedSinceBegin` par `this.sinceBegin.elapsed`. Là où la chaîne redémarre un maillon (`begin`), ajouter `this.sinceBegin.reset();`.

Migrer `apps/dino-brawl/test/game/scripts/weapon/attacks/attackChain.test.ts` vers `createScriptHarness` + `harness.advance(dt)`, sur le modèle de l'étape 1.

- [ ] **Step 8bis: Rattraper les deux fichiers de test qui construisent des scripts non liés**

Dans `apps/dino-brawl/test/game/scripts/combat/meleeHitResolver.test.ts` : remplacer les onze `new HurtboxScript()` par une fabrique qui rend le script **et** son harness, et chaque `hurtbox.onUpdate(DT)` par l'avance de ce harness.

```ts
type Target = {
  hurtbox: HurtboxScript;
  advance: (dt: number) => void;
};

function createHurtbox(invincibilityDuration: number = 0): Target {
  const harness: ScriptHarness<HurtboxScript> = createScriptHarness(
    HurtboxScript,
    { props: { invincibilityDuration } },
  );
  harness.create();

  return { hurtbox: harness.script, advance: harness.advance };
}
```

`createInvincibleHurtbox(d)` devient `createHurtbox(d).hurtbox`, à ceci près qu'il doit maintenant appeler `harness.create()` — sans quoi le `countdown` n'existe pas.

Dans `apps/dino-brawl/test/game/scripts/weapon/swordScript.test.ts` : `createRig` doit injecter deux faux chronomètres et les avancer dans `frame()`, dans l'ordre du runtime (timers d'abord, `onUpdate` ensuite).

```ts
class FakeStopwatch {
  public elapsed: number = 0;

  public reset(): void {
    this.elapsed = 0;
  }
}
```

```ts
  const floatClock: FakeStopwatch = new FakeStopwatch();
  const attackClock: FakeStopwatch = new FakeStopwatch();

  injected.floatClock = floatClock;
  injected.attackClock = attackClock;
```

en remplacement de `injected.clock = 0;` et `injected.attackClock = 0;`, et :

```ts
    frame: (): void => {
      floatClock.elapsed += DT;
      attackClock.elapsed += DT;
      sword.onUpdate(DT);
    },
```

- [ ] **Step 9: Supprimer l'horloge morte**

Dans `apps/dino-brawl/src/game/scripts/player/PlayerAnimationScript.ts`, supprimer les quatre occurrences de `clock` : la déclaration (`:28`), l'initialisation dans `onCreate` (`:40`), l'incrément (`:49`) et la remise à zéro (`:57`). Ne rien remplacer — le champ n'est jamais lu.

Vérifier qu'il ne reste rien :

```bash
grep -n "clock" apps/dino-brawl/src/game/scripts/player/PlayerAnimationScript.ts
```

Attendu : aucune sortie.

- [ ] **Step 10: Lancer toute la suite de l'app**

```bash
pnpm --filter dino-brawl test
pnpm --filter dino-brawl exec tsc --noEmit -p tsconfig.app.json
```

Attendu : suite verte, type-check sans erreur. Corriger les tests qui injectaient les anciens champs numériques (`cooldownRemaining`, `clock`, `elapsedSinceBegin`) — ils doivent passer par `harness.advance(dt)`.

- [ ] **Step 11: Vérification navigateur**

Invoquer la skill `atlas-verify-webgpu`. À observer :

1. Le dash a toujours un cooldown : deux dashes consécutifs sont refusés dans les ~0,6 s.
2. Les pas de course émettent bien plus vite que les pas de marche (le `Repeater` prend son intervalle à chaud).
3. L'épée flotte au repos et son animation d'attaque se déroule normalement.
4. Frapper un ennemi pendant le cooldown de dash : le cooldown **se suspend** pendant le hitstop — c'est le comportement voulu par le design, et il n'existait pas avant.
5. Enchaîner deux coups : le combo passe au deuxième maillon.

- [ ] **Step 12: Prettier et rendre la main**

```bash
pnpm exec prettier --write apps/dino-brawl/src/game/scripts/player/PlayerDashScript.ts apps/dino-brawl/src/game/scripts/player/MovementEmitterScript.ts apps/dino-brawl/src/game/scripts/player/PlayerAnimationScript.ts apps/dino-brawl/src/game/scripts/combat/HurtboxScript.ts apps/dino-brawl/src/game/scripts/weapon/SwordScript.ts apps/dino-brawl/src/game/scripts/weapon/attacks/AttackChain.ts apps/dino-brawl/test/game/scripts/combat/hurtboxScript.test.ts apps/dino-brawl/test/game/scripts/combat/meleeHitResolver.test.ts apps/dino-brawl/test/game/scripts/weapon/attacks/attackChain.test.ts apps/dino-brawl/test/game/scripts/player/playerDashScript.test.ts apps/dino-brawl/test/game/scripts/player/movementEmitter.test.ts apps/dino-brawl/test/game/scripts/player/playerAnimationScript.test.ts apps/dino-brawl/test/game/scripts/weapon/swordScript.test.ts
```

**S'arrêter** — l'humain commit. **GAMEPLAY-96 est livré à ce point.**

---

## Clôture

Une fois les neuf tâches commitées et la vérification navigateur passée, invoquer `/atlas-done` pour :

1. Passer `memory/atlas/gameplay/scoped-time-and-timers.md` en `status: implemented` avec un `shipped:` daté.
2. Supprimer `memory/atlas/backlog/GAMEPLAY-96-script-timers.md`, `GAMEPLAY-97-scoped-hitstop-timescale.md` et `APP-15-attack-chain-reset-ignores-hitstop.md`.
3. Supprimer ce plan (`memory/atlas/plans/2026-08-26-scoped-time-and-timers.md`) — les plans sont transitoires.
4. Écrire une note de mémoire agent dans `memory/atlas/claude/` sur ce qui a surpris pendant l'implémentation, et l'indexer dans `claude/index.md`.
