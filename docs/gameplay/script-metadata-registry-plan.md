# Registre de métadonnées de script (`registerScriptMetadata`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le décorateur stage-3 `@Expose()` (+ `Symbol.metadata` + Babel) par un registre plain-JS `registerScriptMetadata` comme unique source de vérité runtime des champs exposés de script, avec validation warn, et retirer Babel de toute la toolchain.

**Architecture:** Un `WeakMap<Function, ScriptMetadata>` module-local, alimenté par `registerScriptMetadata(Ctor, metadata)` et lu par `getScriptMetadata` (fusion d'héritage via chaîne de prototypes) / `getExposedFields`. `ScriptManager.injectProps` lit ce registre, copie les champs exposés fournis, et émet un `logger.warn` (jamais de throw) pour les incohérences. Aucune syntaxe décorateur ne subsiste → Babel dégagé de vitest et vite.

**Tech Stack:** TypeScript 5.9, Turborepo + pnpm, vitest (harness `test/helpers/harness.ts`), tsdown (build lib), vite 7 (sandbox), `@atlasjs/utils` (Logger).

## Global Constraints

- **Décorateurs stage-3 supprimés** : aucune syntaxe `@decorator` ne doit subsister dans `packages/gameplay` ni `apps/sandbox` après ce plan.
- **Aucun commentaire dans le code** (règle CLAUDE.md racine).
- **Toujours typer** : paramètres, variables, champs de classe — même trivial.
- **Pas de dépendances circulaires.** `scripting/core` + `scripting/runtime` ne dépendent que de `@atlasjs/nexus`, `@atlasjs/core`, `@atlasjs/utils` (foundational).
- **Typecheck avec `tsc --noEmit`** — jamais `tsc -b` sur `packages/gameplay` (émet des artefacts à côté des sources).
- **Pas de commit automatique hors de ce plan** : chaque tâche finit par un commit explicite (l'utilisateur review).
- `useDefineForClassFields: true` ; les champs injectés sont déclarés `!` (definite-assignment).

---

### Task 1: Registre de métadonnées + tests unitaires (additif)

Crée le module registre et ses tests **sans toucher** à `@Expose` existant (coexistence temporaire, build reste vert). Le test importe le module par chemin direct pour éviter toute collision de barrel (`getExposedFields` existe encore dans `Expose.ts`).

**Files:**
- Create: `packages/gameplay/src/scripting/core/ScriptMetadata.ts`
- Test: `packages/gameplay/test/script-metadata.test.ts`

**Interfaces:**
- Produces:
  - `interface ExposeFieldMetadata { required?: boolean }`
  - `interface ScriptMetadata { exposed: Record<string, ExposeFieldMetadata> }`
  - `registerScriptMetadata(ctor: Function, metadata: ScriptMetadata): void`
  - `getScriptMetadata(ctor: Function): ScriptMetadata | undefined` (fusion d'héritage parent→enfant)
  - `getExposedFields(ctor: Function): Map<string, ExposeFieldMetadata>` (copie, isolation appelant)

- [ ] **Step 1: Écrire le test qui échoue**

Create `packages/gameplay/test/script-metadata.test.ts` :

```ts
import { describe, expect, it } from "vitest";

import {
  ExposeFieldMetadata,
  getExposedFields,
  getScriptMetadata,
  registerScriptMetadata,
} from "../src/scripting/core/ScriptMetadata";

class NoMeta {}

class Simple {}
registerScriptMetadata(Simple, {
  exposed: { a: { required: true }, b: {} },
});

class Base {}
registerScriptMetadata(Base, { exposed: { base: {} } });

class Child extends Base {}
registerScriptMetadata(Child, { exposed: { a: {}, b: {} } });

class GrandChild extends Child {}
registerScriptMetadata(GrandChild, { exposed: { c: {} } });

describe("registerScriptMetadata / getScriptMetadata", () => {
  it("records exposed fields without instantiating", () => {
    expect([...getExposedFields(Simple).keys()].sort()).toEqual(["a", "b"]);
  });

  it("returns undefined / empty for a class without metadata", () => {
    expect(getScriptMetadata(NoMeta)).toBeUndefined();
    expect(getExposedFields(NoMeta).size).toBe(0);
  });

  it("keeps the required flag per field", () => {
    const fields: Map<string, ExposeFieldMetadata> = getExposedFields(Simple);
    expect(fields.get("a")?.required).toBe(true);
    expect(fields.get("b")?.required).toBeUndefined();
  });

  it("merges inherited fields, child over parent", () => {
    expect([...getExposedFields(Child).keys()].sort()).toEqual([
      "a",
      "b",
      "base",
    ]);
  });

  it("never pollutes the parent metadata", () => {
    expect([...getExposedFields(Base).keys()]).toEqual(["base"]);
  });

  it("merges the whole chain for a grandchild", () => {
    expect([...getExposedFields(GrandChild).keys()].sort()).toEqual([
      "a",
      "b",
      "base",
      "c",
    ]);
  });

  it("returns a copy the caller cannot use to mutate the registry", () => {
    const map: Map<string, ExposeFieldMetadata> = getExposedFields(Simple);
    map.set("hacked", {});
    expect(getExposedFields(Simple).has("hacked")).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run script-metadata`
Expected: FAIL — `Failed to resolve import "../src/scripting/core/ScriptMetadata"` (le module n'existe pas encore).

- [ ] **Step 3: Écrire l'implémentation**

Create `packages/gameplay/src/scripting/core/ScriptMetadata.ts` :

```ts
export interface ExposeFieldMetadata {
  required?: boolean;
}

export interface ScriptMetadata {
  exposed: Record<string, ExposeFieldMetadata>;
}

const REGISTRY: WeakMap<Function, ScriptMetadata> = new WeakMap();

export function registerScriptMetadata(
  ctor: Function,
  metadata: ScriptMetadata,
): void {
  REGISTRY.set(ctor, metadata);
}

export function getScriptMetadata(ctor: Function): ScriptMetadata | undefined {
  const chain: Function[] = [];
  let current: Function | null = ctor;

  while (current !== null && current !== Function.prototype) {
    chain.push(current);
    current = Object.getPrototypeOf(current);
  }

  let merged: Record<string, ExposeFieldMetadata> | undefined;

  for (let i: number = chain.length - 1; i >= 0; i--) {
    const own: ScriptMetadata | undefined = REGISTRY.get(chain[i]);

    if (own === undefined) {
      continue;
    }

    merged = { ...(merged ?? {}), ...own.exposed };
  }

  return merged === undefined ? undefined : { exposed: merged };
}

export function getExposedFields(
  ctor: Function,
): Map<string, ExposeFieldMetadata> {
  const metadata: ScriptMetadata | undefined = getScriptMetadata(ctor);
  return new Map<string, ExposeFieldMetadata>(
    Object.entries(metadata?.exposed ?? {}),
  );
}
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run script-metadata`
Expected: PASS (7 tests).

- [ ] **Step 5: Vérifier que la suite complète reste verte**

Run: `pnpm --filter @atlasjs/gameplay test`
Expected: PASS — les tests existants (`expose.test.ts`, `exposed-injection.test.ts`, etc.) passent toujours (`@Expose` intact).

- [ ] **Step 6: Commit**

```bash
git add packages/gameplay/src/scripting/core/ScriptMetadata.ts packages/gameplay/test/script-metadata.test.ts
git commit -m "feat(gameplay): add registerScriptMetadata registry (WeakMap + inheritance merge)"
```

---

### Task 2: Cutover `ScriptManager` + validation warn + suppression `@Expose`

Bascule le runtime sur le nouveau registre, ajoute la validation warn (logger injectable), supprime `Expose.ts`/`SymbolMetadata.ts`, met à jour le barrel, et réécrit/ajoute les tests. Changement **atomique** : entre le swap d'import et la suppression des fichiers legacy, le build serait cassé — donc tout dans une tâche.

**Files:**
- Modify: `packages/gameplay/src/scripting/runtime/ScriptManager.ts`
- Modify: `packages/gameplay/src/scripting/core/index.ts`
- Delete: `packages/gameplay/src/scripting/core/Expose.ts`
- Delete: `packages/gameplay/src/scripting/core/SymbolMetadata.ts`
- Delete: `packages/gameplay/test/expose.test.ts`
- Modify (réécrit): `packages/gameplay/test/exposed-injection.test.ts`
- Test (nouveau): `packages/gameplay/test/script-metadata-validation.test.ts`

**Interfaces:**
- Consumes (Task 1): `ScriptMetadata`, `ExposeFieldMetadata`, `getScriptMetadata`, `registerScriptMetadata`.
- Produces: `new ScriptManager(world, services, logger?)` — 3ᵉ param `logger?: Logger` optionnel (défaut `createLogger("ScriptManager")`).

- [ ] **Step 1: Réécrire `exposed-injection.test.ts` (test qui échoue après le passage au registre)**

Replace le contenu de `packages/gameplay/test/exposed-injection.test.ts` par :

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { AtlasScript, registerScriptMetadata } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class Injected extends AtlasScript<{ label: string; count: number }> {
  public label!: string;
  public count!: number;
  public plain: string = "untouched";
  public labelAtCreate: string | undefined;

  public onCreate(): void {
    this.labelAtCreate = this.label;
  }
}
registerScriptMetadata(Injected, {
  exposed: { label: { required: true }, count: { required: true } },
});

class NoProps extends AtlasScript {
  public ran: boolean = false;

  public onCreate(): void {
    this.ran = true;
  }
}

describe("attach — exposed prop injection", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("injects exposed fields synchronously, before onCreate", () => {
    const e: Entity = h.world.createEntity();
    const s: Injected = h.scripts.attach(e, Injected, {
      label: "hi",
      count: 7,
    });

    expect(s.label).toBe("hi");
    expect(s.count).toBe(7);

    h.frame();
    expect(s.labelAtCreate).toBe("hi");
  });

  it("only assigns exposed fields", () => {
    const e: Entity = h.world.createEntity();
    const s: Injected = h.scripts.attach(e, Injected, {
      label: "x",
      count: 1,
      // @ts-expect-error — "plain" is not part of the declared props
      plain: "hacked",
    });

    expect(s.plain).toBe("untouched");
  });

  it("supports scripts without props (no third argument)", () => {
    const e: Entity = h.world.createEntity();
    const s: NoProps = h.scripts.attach(e, NoProps);

    h.frame();
    expect(s.ran).toBe(true);
  });

  it("type: requires props when the script declares them", () => {
    const e: Entity = h.world.createEntity();
    // @ts-expect-error — Injected requires { label, count }
    h.scripts.attach(e, Injected);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run exposed-injection`
Expected: FAIL — `expect(s.label).toBe("hi")` échoue (`ScriptManager` lit encore `Symbol.metadata`, pas le nouveau registre → aucune injection).

- [ ] **Step 3: Basculer `ScriptManager` sur le registre + logger + validation**

Dans `packages/gameplay/src/scripting/runtime/ScriptManager.ts` :

Remplacer le bloc d'imports du haut :

```ts
import { ServiceRegistry } from "@atlasjs/core";
import { Entity, NexusWorld } from "@atlasjs/nexus";
import { Logger, createLogger } from "@atlasjs/utils";

import { RuntimeScriptContext } from "./RuntimeScriptContext";
import { IncrementalScriptIdGenerator } from "./IncrementalScriptIdGenerator";

import {
  AtlasScript,
  ExposeFieldMetadata,
  ScriptConstructor,
  ScriptID,
  ScriptInstanceRecord,
  ScriptMetadata,
  getScriptMetadata,
} from "../core";
```

Ajouter le champ `logger` (à côté des autres champs privés) et l'initialiser dans le constructeur :

```ts
  private readonly logger: Logger;
```

```ts
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
  }
```

Remplacer entièrement `injectProps` :

```ts
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
      if (field in source) {
        target[field] = source[field];
      } else if (exposed[field].required === true) {
        this.logger.warn(
          `[ScriptManager] "${ScriptType.name}" exposes required field "${field}" but no value was provided.`,
        );
      }
    }

    for (const key of Object.keys(source)) {
      if (!(key in exposed)) {
        this.logger.warn(
          `[ScriptManager] prop "${key}" provided to "${ScriptType.name}" is not exposed and was ignored.`,
        );
      }
    }
  }
```

- [ ] **Step 4: Supprimer les fichiers legacy et mettre à jour le barrel**

```bash
git rm packages/gameplay/src/scripting/core/Expose.ts packages/gameplay/src/scripting/core/SymbolMetadata.ts packages/gameplay/test/expose.test.ts
```

Replace `packages/gameplay/src/scripting/core/index.ts` par :

```ts
export * from "./AtlasScript";
export * from "./ScriptContext";
export * from "./ScriptComponent";
export * from "./ScriptService";
export * from "./ScriptLifeCycle";
export * from "./core-types";
export * from "./ScriptMetadata";
```

- [ ] **Step 5: Écrire le test de validation (nouveau)**

Create `packages/gameplay/test/script-metadata-validation.test.ts` :

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Entity } from "@atlasjs/nexus";
import { Logger } from "@atlasjs/utils";

import {
  AtlasScript,
  ScriptManager,
  registerScriptMetadata,
} from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class Required extends AtlasScript<{ needed: string }> {
  public needed!: string;
}
registerScriptMetadata(Required, { exposed: { needed: { required: true } } });

class Optional extends AtlasScript<{ a: string }> {
  public a!: string;
}
registerScriptMetadata(Optional, { exposed: { a: { required: true } } });

class Bare extends AtlasScript {}

describe("attach — prop/metadata validation", () => {
  let h: Harness;
  let warn: ReturnType<typeof vi.fn>;
  let sm: ScriptManager;

  beforeEach(async () => {
    h = await createHarness();
    warn = vi.fn();
    const logger: Logger = {
      warn,
      error: vi.fn(),
      log: vi.fn(),
      debug: vi.fn(),
    } as unknown as Logger;
    sm = new ScriptManager(h.world, h.services, logger);
  });

  it("warns when a required field has no provided value", () => {
    const e: Entity = h.world.createEntity();
    sm.attach(e, Required, {} as { needed: string });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("needed");
  });

  it("warns when a provided key is not exposed", () => {
    const e: Entity = h.world.createEntity();
    const props: { a: string; b: string } = { a: "x", b: "y" };
    sm.attach(e, Optional, props);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("b");
  });

  it("does not warn for a script without metadata or props", () => {
    const e: Entity = h.world.createEntity();
    sm.attach(e, Bare);

    expect(warn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Lancer les tests scripting, vérifier le succès**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run exposed-injection script-metadata`
Expected: PASS — injection (4 tests) + registre (7 tests) + validation (3 tests).

- [ ] **Step 7: Typecheck + suite complète**

Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit -p tsconfig.test.json`
Expected: aucune erreur (plus aucune référence à `Expose`/`getExposedFields` legacy/`Symbol.metadata`).

Run: `pnpm --filter @atlasjs/gameplay test`
Expected: PASS (toute la suite).

- [ ] **Step 8: Commit**

```bash
git add packages/gameplay/src/scripting packages/gameplay/test
git commit -m "feat(gameplay): route script injection through registerScriptMetadata + warn validation; drop @Expose/Symbol.metadata"
```

---

### Task 3: Retirer Babel de la toolchain `@atlasjs/gameplay`

Plus aucun décorateur dans le package → le plugin Babel de vitest et les devdeps deviennent inutiles.

**Files:**
- Modify: `packages/gameplay/vitest.config.ts`
- Modify: `packages/gameplay/package.json`

**Interfaces:**
- Consumes: rien (nettoyage toolchain).
- Produces: rien.

- [ ] **Step 1: Retirer le plugin Babel de vitest**

Replace `packages/gameplay/vitest.config.ts` par :

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __DEV__: "false",
    __CONSOLE_TRANSPORT__: "false",
    __WEBSOCKET_TRANSPORT__: "false",
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Retirer les devDependencies Babel**

Dans `packages/gameplay/package.json`, supprimer entièrement le bloc `devDependencies` (il ne contenait que les deux deps Babel) : retirer

```json
  "devDependencies": {
    "@babel/plugin-proposal-decorators": "catalog:",
    "@rolldown/plugin-babel": "catalog:"
  }
```

(et la virgule qui le précède, après le bloc `dependencies`).

- [ ] **Step 3: Rafraîchir le lockfile**

Run: `pnpm install`
Expected: succès, lockfile mis à jour (deps Babel retirées de gameplay).

- [ ] **Step 4: Vérifier tests + typecheck + build**

Run: `pnpm --filter @atlasjs/gameplay test`
Expected: PASS (Babel absent, aucun test n'utilise de décorateur).

Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit -p tsconfig.test.json`
Expected: aucune erreur.

Run: `pnpm --filter @atlasjs/gameplay build`
Expected: build tsdown OK (`dist` régénéré avec la nouvelle API publique : `registerScriptMetadata`/`getScriptMetadata`/`getExposedFields`, plus de `Expose`).

- [ ] **Step 5: Commit**

```bash
git add packages/gameplay/vitest.config.ts packages/gameplay/package.json pnpm-lock.yaml
git commit -m "chore(gameplay): drop Babel decorator toolchain (no decorators remain)"
```

---

### Task 4: Migrer `apps/sandbox` + retirer Babel du sandbox

Passe `TestScript` de `@Expose()` à `registerScriptMetadata`, retire Babel de vite, valide visuellement.

**Files:**
- Modify: `apps/sandbox/src/game/scripts/TestScript.ts`
- Modify: `apps/sandbox/vite.config.ts`
- Modify: `apps/sandbox/package.json`

**Interfaces:**
- Consumes (Task 1–3, via `dist` de gameplay reconstruit) : `registerScriptMetadata`.
- Produces: rien (application).
- Note: `apps/sandbox/src/game/EcsScene.ts` est **inchangé** — l'appel `attach(player1, TestScript, { clips, controls, sprite, speed })` fournit déjà les 4 props.

- [ ] **Step 1: Migrer `TestScript`**

Dans `apps/sandbox/src/game/scripts/TestScript.ts` :

Remplacer le bloc d'import `@atlasjs/gameplay` — retirer `Expose`, ajouter `registerScriptMetadata` :

```ts
import {
  type ActionMapDescriptor,
  type ButtonActionSpec,
  type Vector2ActionSpec,
  Animator,
  AtlasScript,
  ButtonAction,
  PlayerInput,
  RigidBody2DComponent,
  Sprite,
  SpriteAnimation,
  SpriteRendererComponent,
  Transform2DComponent,
  Vector2Action,
  registerScriptMetadata,
} from "@atlasjs/gameplay";
```

Retirer les 4 `@Expose()` au-dessus des champs, et passer `speed` en definite-assignment (`!`, car injecté) :

```ts
  private readonly sprite!: Sprite;
  private readonly clips!: Record<string, SpriteAnimation>;
  private readonly speed!: number;
  private readonly controls!: PlayerControlsDescriptor;
```

Ajouter, **après** la classe (fin de fichier) :

```ts
registerScriptMetadata(TestScript, {
  exposed: {
    sprite: { required: true },
    clips: { required: true },
    speed: { required: true },
    controls: { required: true },
  },
});
```

- [ ] **Step 2: Retirer Babel de vite**

Replace `apps/sandbox/vite.config.ts` par :

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@css": "/css",
      "@sandbox": "/src",
    },
  },
  define: {
    __DEV__: "true",
    __CONSOLE_TRANSPORT__: "true",
    __WEBSOCKET_TRANSPORT__: "false",
  },
});
```

- [ ] **Step 3: Retirer les devDependencies Babel du sandbox**

Dans `apps/sandbox/package.json`, supprimer les deux lignes du bloc `devDependencies` :

```json
    "@babel/plugin-proposal-decorators": "catalog:",
    "@rolldown/plugin-babel": "catalog:",
```

(garder toutes les autres devdeps intactes).

- [ ] **Step 4: Rafraîchir le lockfile**

Run: `pnpm install`
Expected: succès, deps Babel retirées du sandbox.

- [ ] **Step 5: Typecheck + build sandbox**

Run: `pnpm --filter sandbox build`
Expected: build vite OK, aucune erreur TS (le `dist` de gameplay régénéré au Task 3 expose `registerScriptMetadata` ; plus aucune syntaxe décorateur).

> Note toolchain : `ESNext.Decorators` reste dans `tsconfig.base.json` et `apps/sandbox/tsconfig.app.json` — inerte désormais, laissé en place (inoffensif, retrait optionnel hors périmètre). `erasableSyntaxOnly` du sandbox reste valide (aucun décorateur à effacer).

- [ ] **Step 6: Validation visuelle**

Démarrer le dev server du sandbox (via l'outil de preview du Browser, `preview_start` avec la config sandbox, ou `pnpm --filter sandbox dev`) et charger la page.
Vérifier :
- Le dino s'affiche et **s'anime** (idle → run au mouvement) — l'injection `sprite`/`clips` de bout en bout fonctionne.
- La console navigateur ne contient **aucun** warn `[ScriptManager] ... is not exposed` ni `... required field ... no value` (les 4 props sont fournies et exposées).

- [ ] **Step 7: Commit**

```bash
git add apps/sandbox/src/game/scripts/TestScript.ts apps/sandbox/vite.config.ts apps/sandbox/package.json pnpm-lock.yaml
git commit -m "refactor(sandbox): migrate TestScript to registerScriptMetadata; drop Babel"
```

---

## Notes de clôture

- Après le Task 4, mettre à jour `packages/gameplay/CLAUDE.md` (mention de `scripting/core/` listant `Expose`) et éventuellement `docs/gameplay/exposed-script-variables.md` (marquer l'implémentation `@Expose` comme remplacée par [`script-metadata-registry.md`](script-metadata-registry.md)) — **hors périmètre code**, à faire dans un commit doc séparé si souhaité.
- Le backlog ([`docs/backlog.md`](../backlog.md)) est déjà à jour (pivot + smells de scripting par sévérité).
