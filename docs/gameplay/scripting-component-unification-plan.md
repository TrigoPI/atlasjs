# Scripting Component Unification — Phase A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre la frontière façade/raw principielle (façade ⇔ comportement moteur réel) et unifier le vocabulaire de composants côté script, sans compilateur ni nouveau primitif.

**Architecture:** On supprime les deux façades passthrough (`RigidBody2DComponent`, `SpriteRendererComponent`), on renomme la seule façade justifiée `Transform2DComponent → Transform`, et on expose des **alias d'export propres** (`RigidBody = RigidBody2D`, `SpriteRenderer = SpriteRender`). Les scripts accèdent aux composants données pures en **brut** (option a : accès champ, plus de setters fluent). Le dispatch `RuntimeScriptContext` (`prototype instanceof ScriptComponent`) reste inchangé — seul `Transform` emprunte la branche façade.

**Tech Stack:** TypeScript, `@atlasjs/gameplay` (pnpm workspace), vitest, tsdown. Design source : [`scripting-component-unification.md`](scripting-component-unification.md).

## Global Constraints

- **Toujours typer** (params, variables, champs), même trivialement. Copié de la règle repo.
- **Pas de commentaires** ajoutés dans le code (règle repo). Les commentaires existants dans les tests peuvent être conservés/ajustés.
- **Typecheck gameplay : `pnpm --filter @atlasjs/gameplay exec tsc --noEmit`** — jamais `tsc -b` (il émet des artefacts à côté des sources).
- **Tests gameplay : `pnpm --filter @atlasjs/gameplay test`** (vitest). Le harness `test/helpers/harness.ts` boote un `Engine` réel.
- **Typecheck sandbox : `pnpm --filter sandbox exec tsc -b`** (le sandbox utilise `tsc -b` via references).
- **Invariant façade** : une façade est apatride — aucun état par-instance au-delà de `(world, entity)` ; re-résolution via `requireComponent` à chaque accès. Ne pas réintroduire de cache.
- **Types `any[]` load-bearing** sur `getComponent`/`hasComponent`/`removeComponent`/`requireComponent` : ne pas resserrer en `unknown[]` (casse le dispatch façade).
- Cadence : une tâche à la fois, chaque tâche verte (tsc + tests), l'auteur commite chaque tâche.

---

## File Structure

**Source (`packages/gameplay/src/`)**
- `scripting/components/Transform2DComponent.ts` → **renommé** `Transform.ts` ; classe `Transform2DComponent` → `Transform`.
- `scripting/components/RigidBody2DComponent.ts` → **supprimé**.
- `scripting/components/SpriteRendererComponent.ts` → **supprimé**.
- `scripting/components/index.ts` → **modifié** : exporte `Transform` + alias `RigidBody`, `SpriteRenderer`.

**Tests (`packages/gameplay/test/`)**
- `sprite-renderer-facade.test.ts` → **supprimé** (la façade testée n'existe plus).
- `script-component-alias.test.ts` → **créé** (les alias renvoient le composant moteur brut).
- `script-context-dispatch.test.ts` → **réécrit** (façade branch via `Transform`, raw branch via `RigidBody`).
- `script-components.test.ts`, `script-integration.test.ts`, `determinism.test.ts`, `transform-parent-facade.test.ts` → **modifiés** (renommages + migration raw).

**Sandbox (`apps/sandbox/src/game/scripts/`)**
- `TestScript.ts`, `WallScript.ts`, `SwordScript.ts` → **modifiés** (noms propres + accès brut option a).

**Docs**
- `packages/gameplay/CLAUDE.md`, `docs/gameplay/gameplay-redesign.md`, `docs/gameplay/scripting-components.md` → **modifiés**.

---

### Task 1: Rename `Transform2DComponent` → `Transform` (mechanical, atomic)

Renommage pur, les deux autres façades restent en place → tout compile et les tests passent inchangés.

**Files:**
- Rename: `packages/gameplay/src/scripting/components/Transform2DComponent.ts` → `Transform.ts`
- Modify: `packages/gameplay/src/scripting/components/index.ts`
- Modify (tests): `test/determinism.test.ts`, `test/script-components.test.ts`, `test/script-context-dispatch.test.ts`, `test/script-integration.test.ts`, `test/transform-parent-facade.test.ts`
- Modify (sandbox): `apps/sandbox/src/game/scripts/TestScript.ts`, `WallScript.ts`, `SwordScript.ts`

**Interfaces:**
- Produces: classe `Transform extends ScriptComponent<Transform2D>` avec `static engine = Transform2D`, exportée depuis `@atlasjs/gameplay` sous le nom `Transform`. API inchangée (`position`/`rotation`/`scale`, `setPosition`/`setRotation`/`setScale`/`translate`/`rotate`, `parent`/`getChildren`/`setParent`, `worldPosition`).

- [ ] **Step 1: Rename the source file**

```bash
git mv packages/gameplay/src/scripting/components/Transform2DComponent.ts \
       packages/gameplay/src/scripting/components/Transform.ts
```

- [ ] **Step 2: Rename the class and its internal self-references in `Transform.ts`**

Dans `packages/gameplay/src/scripting/components/Transform.ts`, remplacer **toutes** les occurrences de `Transform2DComponent` par `Transform`. Il y en a 5 : la déclaration de classe (`export class Transform extends ScriptComponent<Transform2D>`), le type de retour du getter `parent` (`public get parent(): Transform | null`), le `new Transform(this.world, parentEntity)` dans `parent`, le type de retour de `getChildren` (`public getChildren(): Transform[]`), le tableau local `const result: Transform[] = []`, et le `new Transform(this.world, children[i])`. Le champ `public static readonly engine = Transform2D;` (le composant moteur) **ne change pas**.

- [ ] **Step 3: Update the scripting-components barrel**

`packages/gameplay/src/scripting/components/index.ts` :

```ts
export * from "./RigidBody2DComponent";
export * from "./SpriteRendererComponent";
export * from "./Transform";
```

- [ ] **Step 4: Update all test references**

Dans chacun de ces fichiers, remplacer toutes les occurrences de `Transform2DComponent` par `Transform` (imports, types de champ, `new Transform2DComponent(...)`, `toBeInstanceOf(Transform2DComponent)`) :
- `test/determinism.test.ts`
- `test/script-components.test.ts`
- `test/script-context-dispatch.test.ts`
- `test/script-integration.test.ts`
- `test/transform-parent-facade.test.ts`

Ne **pas** toucher aux références `RigidBody2DComponent` (traitées en Task 3).

- [ ] **Step 5: Update sandbox scripts (Transform only)**

Dans `TestScript.ts`, `WallScript.ts`, `SwordScript.ts` : remplacer `Transform2DComponent` par `Transform` (import + type de champ + `addComponent(Transform2DComponent)` → `addComponent(Transform)`). Laisser `RigidBody2DComponent`/`SpriteRendererComponent` intacts pour l'instant.

- [ ] **Step 6: Typecheck + tests + sandbox**

Run:
```bash
pnpm --filter @atlasjs/gameplay exec tsc --noEmit
pnpm --filter @atlasjs/gameplay test
pnpm --filter sandbox exec tsc -b
```
Expected: tsc clean, tous les tests PASS (comportement inchangé), sandbox tsc clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(gameplay): rename Transform2DComponent facade to Transform"
```

---

### Task 2: Remove `SpriteRendererComponent`, add `SpriteRenderer` alias, migrate to raw

**Files:**
- Delete: `packages/gameplay/src/scripting/components/SpriteRendererComponent.ts`
- Modify: `packages/gameplay/src/scripting/components/index.ts`
- Delete: `packages/gameplay/test/sprite-renderer-facade.test.ts`
- Create: `packages/gameplay/test/script-component-alias.test.ts`
- Modify (sandbox): `TestScript.ts`, `WallScript.ts`, `SwordScript.ts`

**Interfaces:**
- Consumes: `SpriteRender` (composant moteur, `components/SpriteRender.ts`, ctor `(sprite, color?, flipX?, flipY?, visible?, sortingOrder?)`).
- Produces: `SpriteRenderer` exporté depuis `@atlasjs/gameplay` = alias de `SpriteRender`. `addComponent(SpriteRenderer, sprite)` renvoie l'instance brute `SpriteRender`.

- [ ] **Step 1: Write the failing test (alias returns the raw component)**

Créer `packages/gameplay/test/script-component-alias.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { Sprite } from "../src/assets";
import { SpriteRender } from "../src/components";
import { AtlasScript, SpriteRenderer } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

const sprite: Sprite = { texture: null } as unknown as Sprite;

class AliasProbe extends AtlasScript {
  public spriteRenderer!: SpriteRender;

  public onCreate(): void {
    this.spriteRenderer = this.addComponent(SpriteRenderer, sprite);
  }
}

describe("Gameplay — script component aliases (raw engine components)", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("addComponent(SpriteRenderer, sprite) returns the raw SpriteRender", () => {
    const e: Entity = h.world.createEntity();
    const probe: AliasProbe = h.scripts.attach(e, AliasProbe);

    h.frame();

    expect(probe.spriteRenderer).toBeInstanceOf(SpriteRender);
    expect(h.world.requireComponent(e, SpriteRender)).toBe(probe.spriteRenderer);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay test script-component-alias`
Expected: FAIL — `SpriteRenderer` n'est pas encore exporté (import error).

- [ ] **Step 3: Delete the passthrough façade + wire the alias**

Supprimer le fichier :
```bash
git rm packages/gameplay/src/scripting/components/SpriteRendererComponent.ts
```

`packages/gameplay/src/scripting/components/index.ts` :

```ts
export { SpriteRender as SpriteRenderer } from "../../components";

export * from "./RigidBody2DComponent";
export * from "./Transform";
```

- [ ] **Step 4: Delete the obsolete façade test**

```bash
git rm packages/gameplay/test/sprite-renderer-facade.test.ts
```

- [ ] **Step 5: Run the alias test to verify it passes**

Run: `pnpm --filter @atlasjs/gameplay test script-component-alias`
Expected: PASS.

- [ ] **Step 6: Migrate the sandbox scripts to `SpriteRenderer` (raw access)**

`TestScript.ts` : import `SpriteRendererComponent` → `SpriteRenderer` ; type de champ `private spriteRenderer: SpriteRenderer;` ; `this.addComponent(SpriteRenderer, this.sprite)`. Le `this.spriteRenderer.flipX = v.x < 0` en `onUpdate` reste (champ brut).

`WallScript.ts` : import + type `SpriteRenderer` ; `this.addComponent(SpriteRenderer, this.sprite)` ; remplacer la chaîne fluent :
```ts
// avant
this.spriteRenderer.setColor(0, 1, 0, 0.5).setSortingOrder(10);
// après
this.spriteRenderer.color.set(0, 1, 0, 0.5);
this.spriteRenderer.sortingOrder = 10;
```

`SwordScript.ts` : import + type `SpriteRenderer` ; `this.addComponent(SpriteRenderer, this.sprite)` ; remplacer :
```ts
// avant
this.spriteRenderer.setSortingOrder(10);
// après
this.spriteRenderer.sortingOrder = 10;
```

- [ ] **Step 7: Typecheck + tests + sandbox**

Run:
```bash
pnpm --filter @atlasjs/gameplay exec tsc --noEmit
pnpm --filter @atlasjs/gameplay test
pnpm --filter sandbox exec tsc -b
```
Expected: tout vert.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(gameplay): drop SpriteRendererComponent facade, use raw SpriteRender via SpriteRenderer alias"
```

---

### Task 3: Remove `RigidBody2DComponent`, add `RigidBody` alias, migrate to raw

**Files:**
- Delete: `packages/gameplay/src/scripting/components/RigidBody2DComponent.ts`
- Modify: `packages/gameplay/src/scripting/components/index.ts`
- Modify: `packages/gameplay/test/script-component-alias.test.ts`
- Rewrite: `packages/gameplay/test/script-context-dispatch.test.ts`
- Modify: `packages/gameplay/test/script-components.test.ts`, `packages/gameplay/test/script-integration.test.ts`
- Modify (sandbox): `TestScript.ts`, `WallScript.ts`

**Interfaces:**
- Consumes: `RigidBody2D` (composant moteur, `components/RigidBody2D.ts`, ctor `()`, champs `type`/`mass`/`velocity`/`angularVelocity`/`rotation`).
- Produces: `RigidBody` exporté depuis `@atlasjs/gameplay` = alias de `RigidBody2D`. `addComponent(RigidBody)` renvoie l'instance brute `RigidBody2D`.

- [ ] **Step 1: Add a failing test (RigidBody alias returns raw)**

Dans `packages/gameplay/test/script-component-alias.test.ts`, ajouter l'import et un `it`. Import mis à jour :

```ts
import { RigidBody2D, SpriteRender } from "../src/components";
import { AtlasScript, RigidBody, SpriteRenderer } from "../src/scripting";
```

Étendre `AliasProbe` et ajouter le test :

```ts
class AliasProbe extends AtlasScript {
  public spriteRenderer!: SpriteRender;
  public rigidbody!: RigidBody2D;

  public onCreate(): void {
    this.spriteRenderer = this.addComponent(SpriteRenderer, sprite);
    this.rigidbody = this.addComponent(RigidBody);
  }
}
```

```ts
it("addComponent(RigidBody) returns the raw RigidBody2D", () => {
  const e: Entity = h.world.createEntity();
  const probe: AliasProbe = h.scripts.attach(e, AliasProbe);

  h.frame();

  expect(probe.rigidbody).toBeInstanceOf(RigidBody2D);
  expect(h.world.requireComponent(e, RigidBody2D)).toBe(probe.rigidbody);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay test script-component-alias`
Expected: FAIL — `RigidBody` n'est pas exporté.

- [ ] **Step 3: Delete the passthrough façade + wire the alias**

```bash
git rm packages/gameplay/src/scripting/components/RigidBody2DComponent.ts
```

`packages/gameplay/src/scripting/components/index.ts` :

```ts
export { RigidBody2D as RigidBody } from "../../components";
export { SpriteRender as SpriteRenderer } from "../../components";

export * from "./Transform";
```

- [ ] **Step 4: Run the alias test to verify it passes**

Run: `pnpm --filter @atlasjs/gameplay test script-component-alias`
Expected: PASS (les deux `it`).

- [ ] **Step 5: Rewrite `script-context-dispatch.test.ts`**

Remplacer le contenu **entier** par (façade branch via `Transform` — la seule façade — et raw branch via `RigidBody`/`Health`) :

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { RigidBody2D, Transform2D } from "../src/components";
import { AtlasScript, RigidBody, Transform } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class Health {
  public hp: number;

  public constructor(hp: number = 100) {
    this.hp = hp;
  }
}

// Façade branch (Transform) + raw branch (RigidBody alias + Health data).
class DispatchProbe extends AtlasScript {
  public transform!: Transform;
  public health!: Health;
  public hadTransformBefore: boolean = true;
  public transformBefore: Transform | undefined;
  public hadTransformEngine: boolean = false;
  public rigidbodyRaw: RigidBody2D | undefined;

  public onCreate(): void {
    this.hadTransformBefore = this.hasComponent(Transform);
    this.transformBefore = this.getComponent(Transform);

    this.transform = this.addComponent(Transform);
    this.transform.setPosition(11, 22);
    this.hadTransformEngine = this.hasComponent(Transform);

    this.health = this.addComponent(Health, 50);
    this.rigidbodyRaw = this.getComponent(RigidBody);
  }
}

describe("Gameplay — script context dispatch (façade vs raw)", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.physics.clear();
  });

  it("addComponent(façade) adds the backing engine component and proxies it", () => {
    const e: Entity = h.world.createEntity();
    const probe: DispatchProbe = h.scripts.attach(e, DispatchProbe);

    h.frame();

    expect(h.world.hasComponent(e, Transform2D)).toBe(true);
    const real: Transform2D = h.world.requireComponent(e, Transform2D);
    expect(real.position.x).toBe(11);
    expect(real.position.y).toBe(22);
    expect(probe.transform).toBeInstanceOf(Transform);
  });

  it("hasComponent/getComponent(façade) reflect the backing engine component", () => {
    const e: Entity = h.world.createEntity();
    const probe: DispatchProbe = h.scripts.attach(e, DispatchProbe);

    h.frame();

    expect(probe.hadTransformBefore).toBe(false);
    expect(probe.transformBefore).toBeUndefined();
    expect(probe.hadTransformEngine).toBe(true);
  });

  it("addComponent(dataComponent, ...args) forwards args and returns the raw instance", () => {
    const e: Entity = h.world.createEntity();
    const probe: DispatchProbe = h.scripts.attach(e, DispatchProbe);

    h.frame();

    expect(probe.health).toBeInstanceOf(Health);
    expect(probe.health.hp).toBe(50);
    expect(h.world.requireComponent(e, Health)).toBe(probe.health);
  });

  it("getComponent(rawAlias) uses the raw branch and returns undefined when absent", () => {
    const e: Entity = h.world.createEntity();
    const probe: DispatchProbe = h.scripts.attach(e, DispatchProbe);

    h.frame();

    expect(probe.rigidbodyRaw).toBeUndefined();
  });

  it("removeComponent(façade) removes the backing engine component", () => {
    const e: Entity = h.world.createEntity();
    const probe: DispatchProbe = h.scripts.attach(e, DispatchProbe);

    h.frame();

    expect(h.world.hasComponent(e, Transform2D)).toBe(true);
    probe.removeComponent(Transform);
    expect(h.world.hasComponent(e, Transform2D)).toBe(false);
  });

  it("requireComponent(façade) throws when the engine component is missing", () => {
    const e: Entity = h.world.createEntity();
    const bare: AtlasScript = h.scripts.attach(e, class extends AtlasScript {});

    h.frame();

    expect(() => bare.requireComponent(Transform)).toThrow();
  });
});
```

- [ ] **Step 6: Update `script-components.test.ts` (drop the RigidBody façade case)**

- Import ligne 6 : `import { RigidBody2DComponent, Transform } from "../src/scripting";` → `import { Transform } from "../src/scripting";` (retirer `RigidBody2DComponent` ; `Transform` déjà renommé en Task 1).
- Supprimer le dernier bloc `it("RigidBody2DComponent writes through to the real component", ...)` (le commentaire `// --- RigidBody2D façade proxies the real component ---` inclus). `RigidBody2D` reste importé depuis `../src/components` (utilisé par les tests d'autorité kinematic/dynamic).

- [ ] **Step 7: Migrate `script-integration.test.ts` to raw RigidBody**

Import :
```ts
import { AtlasScript, RigidBody, Transform } from "../src/scripting";
```
`KinematicMover` :
```ts
class KinematicMover extends AtlasScript {
  private transform!: Transform;
  private rigidbody!: RigidBody2D;

  public onCreate(): void {
    this.transform = this.addComponent(Transform);
    this.rigidbody = this.addComponent(RigidBody);
    this.rigidbody.type = "kinematic";
    this.transform.setPosition(100, 0);
  }

  public onFixedUpdate(): void {
    this.transform.translate(10, 0);
  }
}
```
Ajouter `RigidBody2D` à l'import moteur ligne 5 : `import { RigidBody2D, Transform2D } from "../src/components";`.

- [ ] **Step 8: Migrate the sandbox scripts to `RigidBody` (raw access)**

`TestScript.ts` : import `RigidBody2DComponent` → `RigidBody` ; type de champ `private rigidbody: RigidBody;` ; `this.addComponent(RigidBody)` ; `this.rigidbody.type = "kinematic"` reste (champ) ; remplacer `this.rigidbody.setMass(1)` → `this.rigidbody.mass = 1`.

`WallScript.ts` : import + type `RigidBody` ; `this.rb = this.addComponent(RigidBody)` ; `this.rb.type = "static"` reste (champ).

- [ ] **Step 9: Typecheck + tests + sandbox**

Run:
```bash
pnpm --filter @atlasjs/gameplay exec tsc --noEmit
pnpm --filter @atlasjs/gameplay test
pnpm --filter sandbox exec tsc -b
```
Expected: tout vert. Plus aucune référence à `RigidBody2DComponent`/`SpriteRendererComponent` dans le repo :
```bash
grep -rn "RigidBody2DComponent\|SpriteRendererComponent" --include="*.ts" packages apps | grep -v "/dist/"
```
Expected: aucune sortie.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(gameplay): drop RigidBody2DComponent facade, use raw RigidBody2D via RigidBody alias"
```

---

### Task 4: Documentation

**Files:**
- Modify: `packages/gameplay/CLAUDE.md`
- Modify: `docs/gameplay/gameplay-redesign.md`
- Modify: `docs/gameplay/scripting-components.md`

- [ ] **Step 1: Rewrite the taxonomy rule in the package CLAUDE.md**

Dans `packages/gameplay/CLAUDE.md`, section « The two component levels » : remplacer la description LEVEL-2 pour refléter la nouvelle règle. Points à écrire :
- La **seule** façade est `Transform` (`scripting/components/Transform.ts`), justifiée par un comportement réel (routage d'autorité `setPosition`→body dynamic, hiérarchie, world-matrix).
- Règle : **façade ⇔ comportement moteur réel**. Les composants données pures (`RigidBody2D`, `SpriteRender`, `Animator`, `PlayerInput`) sont utilisés **bruts** ; le barrel scripting expose des alias propres `RigidBody`/`SpriteRenderer` (les noms `Animator`/`PlayerInput` sont déjà propres).
- Vocabulaire de script uniforme : `addComponent(X, …)` sans suffixe `*Component`.
- Noter l'asymétrie de péremption assumée : une réf brute périme silencieusement si le composant est retiré/re-ajouté ; une façade re-résout et throw.
- Mettre à jour la ligne « Layout » `scripting/components/` (une façade `Transform` + alias) et la section « Façade & service dispatch » (seul `Transform` emprunte la branche façade).

- [ ] **Step 2: Fix the doc↔code drift in `gameplay-redesign.md`**

Dans `docs/gameplay/gameplay-redesign.md` §4, `PhysicsPullSystem` : corriger « Vaut pour `dynamic` **et** `kinematic` » → **dynamic uniquement** (le code fait `if (type !== "dynamic") return`). Ajuster la phrase sur la pose kinematic résolue en conséquence.

- [ ] **Step 3: Add a pointer at the top of `scripting-components.md`**

Ajouter en tête de `docs/gameplay/scripting-components.md` une note : *« Mise à jour : les façades passthrough (`RigidBody2DComponent`, `SpriteRendererComponent`) ont été supprimées et `Transform2DComponent` renommée `Transform`. Voir [`scripting-component-unification.md`](scripting-component-unification.md). »*

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs(gameplay): update component taxonomy rule + fix pull-system drift"
```

---

### Task 5: Final verification

**Files:** aucun changement de code ; vérification bout-en-bout.

- [ ] **Step 1: Full typecheck, tests, build**

Run:
```bash
pnpm --filter @atlasjs/gameplay exec tsc --noEmit
pnpm --filter @atlasjs/gameplay test
pnpm --filter @atlasjs/gameplay build
pnpm --filter sandbox exec tsc -b
```
Expected: tout vert.

- [ ] **Step 2: Confirm no dangling references**

Run:
```bash
grep -rn "Transform2DComponent\|RigidBody2DComponent\|SpriteRendererComponent" --include="*.ts" packages apps | grep -v "/dist/"
```
Expected: aucune sortie.

- [ ] **Step 3: Visual preview (sandbox)**

Démarrer le dev server sandbox (via l'outil preview, `.claude/launch.json`) et vérifier au runtime :
- le joueur (dino) se déplace au clavier (WASD/flèches) et s'anime (idle/run), flip selon la direction ;
- le mur statique vert translucide s'affiche (sortingOrder appliqué) ;
- l'épée suit la souris (rotation).

Capturer un screenshot comme preuve. En cas d'erreur console, diagnostiquer et corriger avant de clore.

- [ ] **Step 4: Commit (si un ajustement a été nécessaire au Step 3)**

```bash
git add -A
git commit -m "chore(gameplay): finalize scripting component unification (phase A)"
```

---

## Self-Review

**1. Spec coverage** (contre [`scripting-component-unification.md`](scripting-component-unification.md) §3) :
- §3.1 supprimer les 2 façades passthrough → Task 2 (Sprite), Task 3 (RigidBody). ✅
- §3.2 renommer `Transform2DComponent → Transform`, façade conservée, dispatch inchangé → Task 1. ✅
- §3.3 noms propres + alias `RigidBody`/`SpriteRenderer` → Task 2/3 (barrel). ✅
- §3.4 migration sandbox (option a) → Task 2 Step 6, Task 3 Step 8. ✅
- §3.5 docs + drift → Task 4. ✅
- §3.6 tests (retrait cas RB façade, ajout cas alias raw) → Task 3 Step 6 + `script-component-alias.test.ts` (Task 2/3). ✅
- §6 ordre d'implémentation (5 étapes, chaque verte) → Tasks 1–5. ✅

**2. Placeholder scan** : aucun TODO/TBD ; chaque step montre le code ou l'opération exacte (fichier + lignes). ✅

**3. Type consistency** : `Transform` (façade), `RigidBody` (= `RigidBody2D`), `SpriteRenderer` (= `SpriteRender`) utilisés de façon cohérente à travers tests + sandbox ; `addComponent(RigidBody)` sans args (ctor `()`), `addComponent(SpriteRenderer, sprite)` (ctor `(sprite, …)`) — conformes aux signatures moteur vérifiées. Le dispatch façade repose sur `Transform.prototype instanceof ScriptComponent` (les alias sont des composants moteur, branche raw). ✅

> Note : le stub `sprite` dans `script-component-alias.test.ts` (`{ texture: null } as unknown as Sprite`) suffit — le test n'exerce que l'add/get, pas le rendu. Si le harness impose un `Sprite` plus riche, réutiliser le helper de `sprite-render.test.ts`.
