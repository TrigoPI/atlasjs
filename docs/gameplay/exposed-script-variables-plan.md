# Variables exposées de script (`@Expose`) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un script d'`AtlasScript` de recevoir des références d'assets (Sprite, clips d'animation) par injection typée via `scriptManager.attach(entity, Script, props)`, façon Unity `[SerializeField]`, débloquant la création de `SpriteRender`/`Animator` depuis le script.

**Architecture:** Décorateur de champ **stage-3** `@Expose()` qui écrit dans `context.metadata` (attaché au constructeur via `Symbol.metadata`, polyfillé). `AtlasScript<TProps>` devient générique ; `attach` gagne un 3ᵉ argument `props` typé (requis si le script déclare des props, absent sinon) et injecte les champs exposés **avant** `onCreate`. Les assets restent fabriqués par la composition root (la scène).

**Tech Stack:** TypeScript 5.9 (décorateurs **stage-3**, sans `experimentalDecorators`), Babel via `@rolldown/plugin-babel` + `@babel/plugin-proposal-decorators` (`2023-11`) pour la transformation (esbuild/oxc ne transforment pas stage-3), vitest 4, tsdown, vite 7 (rollup ; `@rolldown/plugin-babel` s'applique quand même via le container de plugins vite, prouvé par le vitest de gameplay), pnpm/Turborepo.

**Spec de référence :** [docs/gameplay/exposed-script-variables.md](exposed-script-variables.md)

## Global Constraints

- **Décorateurs stage-3 uniquement** (jamais `experimentalDecorators`). La transformation vient de **Babel** — esbuild ET tsdown/oxc laissent les décorateurs stage-3 tels quels (vérifié). Vitest est **déjà configuré** (babel dans `packages/gameplay/vitest.config.ts`, devdeps `@babel/plugin-proposal-decorators` + `@rolldown/plugin-babel` déjà présentes). Le sandbox doit l'être aussi (Task 3).
- **Polyfill `Symbol.metadata`** requis au **top-level** de `SymbolMetadata.ts` (importé par `Expose.ts`) : `(Symbol as { metadata?: symbol }).metadata ??= Symbol.for("Symbol.metadata")`. Doit s'exécuter à l'évaluation du module, avant toute classe décorée ; dans une fonction il tournerait trop tard. Sans lui, babel n'attache pas les métadonnées au constructeur (vérifié).
- **`lib` doit inclure `ESNext.Decorators`** pour que `tsc` type-checke `Symbol.metadata`/`ClassFieldDecoratorContext.metadata`. Ajouté au `tsconfig.base.json` (gameplay en hérite) et au `lib` override du sandbox.
- **`erasableSyntaxOnly` (sandbox) reste** : compatible stage-3 (vérifié) — ne pas le retirer.
- **Aucun commentaire dans le code** (règle projet CLAUDE.md).
- **Tout typer**, même trivialement (params de fonction, variables, params de classe).
- **gameplay ne dépend jamais d'une app** ; `SpriteSheet`/`SpriteAnimation` restent dans nebula, atteints via le re-export `@atlasjs/gameplay`.
- **Typecheck avec `tsc --noEmit`**, jamais `tsc -b` sur gameplay (émet des artefacts à côté des sources — cf. `packages/gameplay/CLAUDE.md`).
- Tests via le harness `packages/gameplay/test/helpers/harness.ts` (`createHarness()`, `h.frame()`).

---

## File Structure

- `packages/gameplay/src/scripting/core/Expose.ts` **(créer / remplacer le stub)** — décorateur `@Expose` stage-3, `getExposedFields`. Responsabilité unique : métadonnées de champs exposés.
- `packages/gameplay/src/scripting/core/SymbolMetadata.ts` **(créer)** — polyfill `Symbol.metadata` (top-level) + accesseur typé `getCtorMetadata`. Isole la préoccupation « lire les métadonnées d'un constructeur » de la définition du décorateur.
- `packages/gameplay/src/scripting/core/AtlasScript.ts` **(modifier)** — rendre la classe générique `AtlasScript<TProps>`.
- `packages/gameplay/src/scripting/core/index.ts` **(déjà modifié)** — exporte déjà `./Expose`.
- `packages/gameplay/src/scripting/runtime/ScriptManager.ts` **(modifier)** — `attach` typé + `injectProps`.
- `tsconfig.base.json` **(modifier)** — ajouter `"ESNext.Decorators"` à `lib`.
- `packages/gameplay/tsconfig.test.json` **(créer)** — typecheck incluant `test/`.
- `packages/gameplay/package.json` **(modifier)** — script `typecheck`.
- `packages/gameplay/test/expose.test.ts` **(remplacer le stub)** — tests du décorateur.
- `packages/gameplay/test/exposed-injection.test.ts` **(créer)** — tests runtime + gardes de type.
- `apps/sandbox/vite.config.ts` **(modifier)** — plugin babel décorateurs.
- `apps/sandbox/package.json` **(modifier)** — devdeps babel.
- `apps/sandbox/tsconfig.app.json` **(modifier)** — `"ESNext.Decorators"` dans `lib`.
- `apps/sandbox/src/game/scripts/TestScript.ts` **(modifier)** — générique + `@Expose` + `addComponent` visuels.
- `apps/sandbox/src/game/EcsScene.ts` **(modifier)** — fabrique les clips, injecte via `attach`.

---

## Task 1: Décorateur `@Expose` + `getExposedFields` (stage-3 / `Symbol.metadata`)

**Files:**
- Modify: `tsconfig.base.json`
- Create/replace: `packages/gameplay/src/scripting/core/Expose.ts`
- Create: `packages/gameplay/src/scripting/core/SymbolMetadata.ts`
- Test: `packages/gameplay/test/expose.test.ts`

**Interfaces:**
- Produces:
  - `Expose(options?: ExposeOptions): (value: undefined, context: ClassFieldDecoratorContext) => void`
  - `getExposedFields(ctor: Function): ExposedMetadata` où `ExposedMetadata = Map<string, ExposeOptions>`
  - `interface ExposeOptions {}` (vide, extensible)

- [x] **Step 1: Ajouter le lib `ESNext.Decorators`**

Dans `tsconfig.base.json`, remplacer la ligne `lib` :

```json
    "lib": ["ES2022", "DOM", "ESNext.Decorators"],
```

- [x] **Step 2: Écrire le test qui échoue**

Remplacer `packages/gameplay/test/expose.test.ts` par :

```ts
import { describe, expect, it } from "vitest";

import { Expose, getExposedFields } from "../src/scripting/core";

class NoExpose {}

class Simple {
  @Expose() public a!: number;
  @Expose() public b!: string;
  public plain!: boolean;
}

class Base {
  @Expose() public base!: number;
}

class Child extends Base {
  @Expose() public a!: string;
  @Expose() public b!: number;
}

class GrandChild extends Child {}

describe("@Expose / getExposedFields", () => {
  it("records exposed fields without instantiating the class", () => {
    expect([...getExposedFields(Simple).keys()].sort()).toEqual(["a", "b"]);
  });

  it("ignores non-decorated fields", () => {
    expect(getExposedFields(Simple).has("plain")).toBe(false);
  });

  it("returns an empty map for classes with no exposed fields", () => {
    expect(getExposedFields(NoExpose).size).toBe(0);
  });

  it("does not leak fields between unrelated classes", () => {
    expect(getExposedFields(Simple).has("base")).toBe(false);
  });

  it("merges fields inherited from base classes", () => {
    expect([...getExposedFields(Child).keys()].sort()).toEqual([
      "a",
      "b",
      "base",
    ]);
  });

  it("does not pollute the base class set (inheritance isolation)", () => {
    expect([...getExposedFields(Base).keys()]).toEqual(["base"]);
  });

  it("lets a subclass without own decorators inherit exposed fields", () => {
    expect([...getExposedFields(GrandChild).keys()].sort()).toEqual([
      "a",
      "b",
      "base",
    ]);
  });

  it("returns a copy that does not mutate the class metadata", () => {
    const map = getExposedFields(Simple);
    map.set("hacked", {});
    expect(getExposedFields(Simple).has("hacked")).toBe(false);
  });
});
```

- [x] **Step 3: Lancer le test — vérifier l'échec**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/expose.test.ts`
Expected: FAIL — `Expose`/`getExposedFields` non implémentés (le stub actuel ne stocke rien).

- [x] **Step 4: Implémenter le décorateur (polyfill extrait dans `SymbolMetadata.ts`)**

Le polyfill `Symbol.metadata` et la lecture des métadonnées d'un constructeur sont isolés dans un module dédié — le polyfill **doit rester au top-level du module** (il tourne à l'évaluation ESM, avant toute classe décorée ; placé dans une fonction il s'exécuterait trop tard et babel n'attacherait jamais les métadonnées).

`packages/gameplay/src/scripting/core/SymbolMetadata.ts` :

```ts
(Symbol as { metadata?: symbol }).metadata ??= Symbol.for("Symbol.metadata");

export function getCtorMetadata<T>(ctor: Function): T | undefined {
  return (ctor as { [Symbol.metadata]?: T })[Symbol.metadata];
}
```

`packages/gameplay/src/scripting/core/Expose.ts` :

```ts
import { getCtorMetadata } from "./SymbolMetadata";

export interface ExposeOptions {}
export type ExposedMetadata = Map<string, ExposeOptions>;

export type FieldDecorator<This = unknown> = (
  value: undefined,
  context: ClassFieldDecoratorContext<This>,
) => void;

const EXPOSED: unique symbol = Symbol("atlas.exposed");

export function Expose(options: ExposeOptions = {}): FieldDecorator {
  return (_: undefined, context: ClassFieldDecoratorContext): void => {
    if (context.private) {
      throw new Error(
        "[@Expose] private (#) fields cannot be exposed; use a soft-private field.",
      );
    }

    const metadata: Record<symbol, ExposedMetadata | undefined> =
      context.metadata as Record<symbol, ExposedMetadata | undefined>;

    let store: ExposedMetadata | undefined = metadata[EXPOSED];

    if (!Object.prototype.hasOwnProperty.call(metadata, EXPOSED)) {
      store = new Map<string, ExposeOptions>(store);
      metadata[EXPOSED] = store;
    }

    (store as ExposedMetadata).set(context.name as string, options);
  };
}

export function getExposedFields(ctor: Function): ExposedMetadata {
  const metadata: Record<symbol, ExposedMetadata | undefined> | undefined =
    getCtorMetadata<Record<symbol, ExposedMetadata | undefined>>(ctor);

  return new Map<string, ExposeOptions>(metadata?.[EXPOSED] ?? []);
}
```

(Le barrel `packages/gameplay/src/scripting/core/index.ts` exporte `./Expose` **et** `./SymbolMetadata`.)

- [x] **Step 5: Lancer le test — vérifier le succès**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/expose.test.ts`
Expected: PASS (8 tests).

- [x] **Step 6: Commit**

```bash
git add tsconfig.base.json \
  packages/gameplay/src/scripting/core/Expose.ts \
  packages/gameplay/src/scripting/core/SymbolMetadata.ts \
  packages/gameplay/src/scripting/core/index.ts \
  packages/gameplay/test/expose.test.ts
git commit -m "feat(gameplay): add @Expose stage-3 decorator + exposed-field metadata"
```

---

## Task 2: `AtlasScript<TProps>` générique + `attach` typé + injection

**Files:**
- Modify: `packages/gameplay/src/scripting/core/AtlasScript.ts`
- Modify: `packages/gameplay/src/scripting/runtime/ScriptManager.ts`
- Create: `packages/gameplay/tsconfig.test.json`
- Modify: `packages/gameplay/package.json`
- Test: `packages/gameplay/test/exposed-injection.test.ts`

**Interfaces:**
- Consumes: `getExposedFields`, `ExposedMetadata` (Task 1).
- Produces:
  - `abstract class AtlasScript<TProps extends object = {}>` (phantom `readonly __props?: TProps`).
  - `ScriptManager.attach<TScript extends AtlasScript>(entityId, ScriptType, ...rest)` où `rest` vaut `[props: PropsOf<TScript>]` si le script déclare des props non vides, sinon `[props?: PropsOf<TScript>]`.

- [x] **Step 1: Rendre `AtlasScript` générique**

Dans `packages/gameplay/src/scripting/core/AtlasScript.ts`, remplacer :

```ts
export abstract class AtlasScript implements ScriptLifecycle {
  private __context?: ScriptContext;
```

par :

```ts
export abstract class AtlasScript<TProps extends object = {}> implements ScriptLifecycle {
  declare public readonly __props?: TProps;

  private __context?: ScriptContext;
```

(Le reste de la classe est inchangé. `__props` est un champ fantôme `declare` — aucune émission runtime — qui porte `TProps` pour l'inférence.)

- [x] **Step 2: Écrire les tests qui échouent (runtime + gardes de type)**

Créer `packages/gameplay/test/exposed-injection.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Entity } from "@atlasjs/nexus";

import { AtlasScript, Expose } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

class Injected extends AtlasScript<{ label: string; count: number }> {
  @Expose() public label!: string;
  @Expose() public count!: number;
  public plain: string = "untouched";
  public labelAtCreate: string | undefined;

  public onCreate(): void {
    this.labelAtCreate = this.label;
  }
}

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
    const s: Injected = h.scripts.attach(e, Injected, { label: "hi", count: 7 });

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

- [x] **Step 3: Lancer les tests runtime — vérifier l'échec**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/exposed-injection.test.ts`
Expected: FAIL — le 1er test échoue (`s.label` vaut `undefined` ; `attach` refuse peut-être le 3ᵉ argument).

- [x] **Step 4: Implémenter le typage + l'injection dans `ScriptManager`**

Dans `packages/gameplay/src/scripting/runtime/ScriptManager.ts` :

4a. Ajouter aux imports depuis `../core` : `getExposedFields` et le type `ExposedMetadata`. La ligne d'import existante devient :

```ts
import {
  AtlasScript,
  ExposedMetadata,
  ScriptConstructor,
  ScriptID,
  ScriptInstanceRecord,
  getExposedFields,
} from "../core";
```

4b. Juste avant la classe `ScriptManager`, ajouter l'alias de type :

```ts
type PropsOf<T> = T extends AtlasScript<infer P> ? P : {};
```

4c. Remplacer la signature et le début de `attach`. Remplacer :

```ts
  public attach<TScript extends AtlasScript>(
    entityId: Entity,
    ScriptType: ScriptConstructor<TScript>,
  ): TScript {
    const instance: TScript = new ScriptType();
    const context: RuntimeScriptContext = new RuntimeScriptContext(
      entityId,
      this.world,
      this.services,
    );

    instance.__bindContext(context);
```

par :

```ts
  public attach<TScript extends AtlasScript>(
    entityId: Entity,
    ScriptType: ScriptConstructor<TScript>,
    ...rest: {} extends PropsOf<TScript>
      ? [props?: PropsOf<TScript>]
      : [props: PropsOf<TScript>]
  ): TScript {
    const instance: TScript = new ScriptType();
    const context: RuntimeScriptContext = new RuntimeScriptContext(
      entityId,
      this.world,
      this.services,
    );

    instance.__bindContext(context);
    this.injectProps(instance, ScriptType, rest[0]);
```

(Le corps restant de `attach` — création du `record`, `recordsByEntity`, `pendingCreate.push`, `return instance` — est inchangé.)

4d. Ajouter la méthode privée `injectProps` (par ex. juste après `attach`) :

```ts
  private injectProps(
    instance: AtlasScript,
    ScriptType: ScriptConstructor,
    props?: object,
  ): void {
    if (props === undefined) {
      return;
    }

    const exposed: ExposedMetadata = getExposedFields(ScriptType);

    if (exposed.size === 0) {
      return;
    }

    const target: Record<string, unknown> = instance as unknown as Record<
      string,
      unknown
    >;
    const source: Record<string, unknown> = props as Record<string, unknown>;

    for (const field of exposed.keys()) {
      if (field in source) {
        target[field] = source[field];
      }
    }
  }
```

- [x] **Step 5: Lancer les tests runtime — vérifier le succès**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/exposed-injection.test.ts`
Expected: PASS (4 tests). (Les lignes `@ts-expect-error` sont inertes au runtime, validées à l'étape 7.)

- [x] **Step 6: Non-régression de toute la suite gameplay**

Run: `pnpm --filter @atlasjs/gameplay test`
Expected: PASS — toutes les suites existantes restent vertes (rétrocompat de `attach` à 2 arguments).

- [x] **Step 7: Ajouter le typecheck et valider les gardes de type**

Créer `packages/gameplay/tsconfig.test.json` :

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

Dans `packages/gameplay/package.json`, ajouter au bloc `"scripts"` :

```json
    "typecheck": "tsc --noEmit -p tsconfig.test.json",
```

Run: `pnpm --filter @atlasjs/gameplay typecheck`
Expected: PASS avec **0 erreur**. Les deux `@ts-expect-error` de `exposed-injection.test.ts` doivent être *satisfaits* (une vraie erreur de type existe à ces lignes). Si tsc signale « Unused '@ts-expect-error' », le typage de `attach` est faux : le corriger.

- [x] **Step 8: Build du package**

Run: `pnpm --filter @atlasjs/gameplay build`
Expected: build tsdown OK (gameplay n'applique aucun décorateur → rien de spécial à transpiler).

- [x] **Step 9: Commit**

```bash
git add packages/gameplay/src/scripting/core/AtlasScript.ts packages/gameplay/src/scripting/runtime/ScriptManager.ts packages/gameplay/tsconfig.test.json packages/gameplay/package.json packages/gameplay/test/exposed-injection.test.ts
git commit -m "feat(gameplay): typed prop injection via attach(entity, Script, props)"
```

---

## Task 3: Migration `apps/sandbox` — script auteur, assets injectés

**Files:**
- Modify: `apps/sandbox/package.json`
- Modify: `apps/sandbox/vite.config.ts`
- Modify: `apps/sandbox/tsconfig.app.json`
- Modify: `apps/sandbox/src/game/scripts/TestScript.ts`
- Modify: `apps/sandbox/src/game/EcsScene.ts`

**Interfaces:**
- Consumes: `attach(entity, Script, props)` (Task 2), `@Expose` (Task 1), `Sprite`/`SpriteAnimation`/`Animator`/`SpriteRendererComponent` (existants).

- [x] **Step 1: Ajouter les devdeps babel au sandbox**

Run:

```bash
pnpm --filter sandbox add -D @rolldown/plugin-babel @babel/plugin-proposal-decorators
```

Expected: les deux devdeps apparaissent dans `apps/sandbox/package.json`.

- [x] **Step 2: Brancher babel dans la config vite du sandbox**

Remplacer `apps/sandbox/vite.config.ts` par (le cast `as unknown as PluginOption` est requis : sous vite **7**, le type de retour de `@rolldown/plugin-babel` — pensé pour rolldown/vite 8 — est structurellement incompatible avec `PluginOption` ; ça n'apparaît que parce que `tsc -b` du sandbox typecheck `vite.config.ts`, le runtime est inchangé) :

```ts
import babel from "@rolldown/plugin-babel";
import { type PluginOption, defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    babel({
      plugins: [["@babel/plugin-proposal-decorators", { version: "2023-11" }]],
    }) as unknown as PluginOption,
  ],
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

- [x] **Step 3: Ajouter `ESNext.Decorators` au lib du sandbox**

Dans `apps/sandbox/tsconfig.app.json`, remplacer la ligne `lib` :

```json
    "lib": ["ES2022", "DOM", "DOM.Iterable", "ESNext.Decorators"],
```

(Laisser `erasableSyntaxOnly` et `useDefineForClassFields` tels quels — compatibles stage-3.)

- [x] **Step 4: Réécrire `TestScript` (générique + `@Expose` + composants visuels)**

Remplacer `apps/sandbox/src/game/scripts/TestScript.ts` par :

```ts
import { Vec2 } from "@atlasjs/math";

import {
  Animator,
  AtlasScript,
  ButtonAction,
  Expose,
  Key,
  PlayerInput,
  RigidBody2DComponent,
  Sprite,
  SpriteAnimation,
  SpriteRendererComponent,
  Transform2DComponent,
  Vector2Action,
  button,
  defineActions,
  vector2,
} from "@atlasjs/gameplay";

const controls = defineActions({
  move: vector2().wasd(),
  boost: button().keys(Key.Space),
});

export class TestScript extends AtlasScript<{
  sprite: Sprite;
  clips: Record<string, SpriteAnimation>;
}> {
  @Expose() private readonly sprite!: Sprite;
  @Expose() private readonly clips!: Record<string, SpriteAnimation>;

  private readonly speed: number = 220;

  private transform!: Transform2DComponent;
  private rigidbody!: RigidBody2DComponent;
  private spriteRenderer!: SpriteRendererComponent;
  private animator!: Animator;

  private move!: Vector2Action;
  private boost!: ButtonAction;

  public onCreate(): void {
    const actions = this.addComponent(PlayerInput, controls);

    this.transform = this.addComponent(Transform2DComponent);
    this.rigidbody = this.addComponent(RigidBody2DComponent);

    this.spriteRenderer = this.addComponent(SpriteRendererComponent, this.sprite);
    this.animator = this.addComponent(Animator, this.clips, "idle");

    this.move = actions.get("move");
    this.boost = actions.get("boost");

    this.rigidbody.type = "kinematic";
    this.transform.setScale(3, 3).setPosition(400, 300);
    this.rigidbody.setMass(1);
  }

  public onUpdate(dt: number): void {
    const v: Vec2 = this.move.readValue();
    const speed: number = this.boost.isDown() ? this.speed * 2 : this.speed;

    if (v.x !== 0 || v.y !== 0) {
      this.animator.play("run");
      this.transform.translate(v.x * speed * dt, v.y * speed * dt);
      this.spriteRenderer.flipX = v.x < 0;
    } else {
      this.animator.play("idle");
    }
  }

  public onDestroy(): void {}
}
```

- [x] **Step 5: Réécrire `EcsScene` (fabrique les clips, injecte)**

Remplacer `apps/sandbox/src/game/EcsScene.ts` par :

```ts
import BlueDino from "../../assets/game/dinos/dino_blue.png";

import { type SceneContext, Scene } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";

import { TestScript } from "./scripts/TestScript";

import {
  type ScriptManager,
  SCRIPT_MANAGER,
  Sprite,
} from "@atlasjs/gameplay";

import {
  type NebulaRenderer,
  type Texture2D,
  NEBULA_RENDERER,
  SpriteAnimation,
  SpriteSheet,
} from "@atlasjs/nebula";

export class EcsScene extends Scene {
  public constructor() {
    super("game-scene");
  }

  public override async onCreate(ctx: SceneContext): Promise<void> {
    const nexus: NexusWorld = ctx.services.get(NEXUS);
    const nebula: NebulaRenderer = ctx.services.get(NEBULA_RENDERER);
    const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);

    const blueDinoTexture: Texture2D = await this.loadTexture(nebula, BlueDino);
    const blueDinoSprite: Sprite = new Sprite(blueDinoTexture);

    const sheet: SpriteSheet = SpriteSheet.fromAutoGrid({
      name: "blue_dino",
      texture: blueDinoTexture,
      rows: 1,
      columns: 24,
    });

    const clips: Record<string, SpriteAnimation> = {
      idle: new SpriteAnimation({
        frames: sheet.getManyInRange("blue_dino_", 0, 3),
        fps: 5,
        loop: true,
        autoPlay: true,
      }),
      run: new SpriteAnimation({
        frames: sheet.getManyInRange("blue_dino_", 4, 9),
        fps: 12,
        loop: true,
        autoPlay: true,
      }),
    };

    const player1: Entity = nexus.createEntity();

    scriptManager.attach(player1, TestScript, {
      sprite: blueDinoSprite,
      clips,
    });
  }

  private async loadTexture(
    nebula: NebulaRenderer,
    src: string,
  ): Promise<Texture2D> {
    const image: HTMLImageElement = new Image();
    image.src = src;
    await image.decode();

    const source: ImageBitmap = await createImageBitmap(image, {
      imageOrientation: "flipY",
    });

    return nebula.createTexture2D({
      source,
      width: source.width,
      height: source.height,
    });
  }
}
```

- [x] **Step 6: Type-check du build sandbox**

Run: `pnpm --filter sandbox build` (ou `pnpm --filter sandbox exec vite build` pour isoler la partie bundling).
Expected : `vite build` OK — transforme le décorateur stage-3 et bundle sans erreur (valide le décorateur + `ESNext.Decorators`). Le typage de `attach(...)` est validé côté gameplay (`pnpm --filter @atlasjs/gameplay typecheck`).
**Note :** `tsc -b` du sandbox est actuellement rouge à cause de **4 erreurs pré-existantes** `noUnusedLocals`/`noUnusedParameters` dans `apps/sandbox/src/game/Player.ts` et `Sword.ts` (code legacy hors ECS, antérieures à cette branche, sans lien avec cette feature) — cleanup séparé.

- [x] **Step 7: Vérification visuelle (dev server)**

Lancer le dev server du sandbox (outil de preview, config `sandbox` dans `.claude/launch.json`), ouvrir la page, puis :
- Console : **aucune** erreur (surtout pas de `SyntaxError` de décorateur, pas de « required component missing »).
- Le dino bleu s'affiche et joue `idle` au repos.
- WASD → déplacement + animation `run` ; `Space` double la vitesse ; retournement (`flipX`) vers la gauche.
- Capturer une screenshot comme preuve.

- [ ] **Step 8: Commit**

```bash
git add apps/sandbox/package.json apps/sandbox/vite.config.ts apps/sandbox/tsconfig.app.json apps/sandbox/src/game/scripts/TestScript.ts apps/sandbox/src/game/EcsScene.ts pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "feat(sandbox): script authors visual components from injected assets"
```

---

## Self-Review

**Spec coverage :**
- §2 toolchain (stage-3 via babel, polyfill, lib, erasableSyntaxOnly) → Task 1 Step 1/4, Task 3 Steps 1–3. ✓
- §3.1 `AtlasScript<TProps>` → Task 2 Step 1. ✓
- §3.2 `@Expose` + `getExposedFields` (polyfill, clone-on-own-write, `#private` throw) → Task 1 Step 4. ✓
- §3.3 `attach` typé + `injectProps` (avant `onCreate`) → Task 2 Steps 4–5. ✓
- §3.4 exports → déjà en place (barrel exporte `./Expose`). ✓
- §3.5 config (babel vitest déjà fait ; babel sandbox ; lib base + sandbox) → Task 1 Step 1, Task 3 Steps 1–3. ✓
- §4 résultat côté jeu (`TestScript`, `EcsScene`) → Task 3 Steps 4–5. ✓
- §6 tests (sans instanciation, isolation, héritage, copie, `#private`, injection avant `onCreate`, non-exposé ignoré, sans props, garde de type) → Task 1 Step 2 + Task 2 Steps 2, 7. ✓
- §5 hors-périmètre : rien à implémenter. ✓

**Placeholder scan :** aucun TBD/TODO ; chaque étape porte le code complet et une commande avec résultat attendu.

**Type consistency :** `Expose`, `getExposedFields`, `ExposedMetadata`, `ExposeOptions`, `EXPOSED`, `PropsOf`, `AtlasScript<TProps>`, `__props`, `injectProps` — noms et signatures cohérents entre Task 1, Task 2 et leurs consommateurs. `attach` : 2 args (rétrocompat) ou 3 args (props) selon `PropsOf`. ✓
