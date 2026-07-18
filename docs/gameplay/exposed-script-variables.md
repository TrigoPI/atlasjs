# Variables exposées de script — `@Expose` + injection typée (`@atlasjs/gameplay`)

> **Statut : design (à implémenter).** Ajoute à la voie scripting un mécanisme d'injection de références d'assets dans les scripts, façon Unity `[SerializeField]` : le script déclare des dépendances via `@Expose()`, la composition root (scène aujourd'hui, `AssetManager`/éditeur demain) les fabrique et les fournit à `scriptManager.attach(entity, Script, props)`. Débloque la création de `SpriteRender`/`Animator` **depuis un script**, sans que le script touche jamais le GPU.
> Prérequis de lecture : `docs/gameplay/scripting-components.md` (les deux niveaux de composants, `AtlasScript`, façades), `docs/gameplay/sprite-animation.md` (`Animator`, `SpriteAnimation`), `docs/rendering/sprites.md` (`Sprite`/`Texture2D`).

---

## 1. Contexte et problème

La règle de couche est respectée : un script n'importe que `@atlasjs/gameplay` et `@atlasjs/math`. Mais trois frictions bloquent l'écriture de vrais scripts de rendu :

1. **`SpriteRender` exige un `Sprite`** à la construction, et **`Sprite` exige un `Texture2D`** (`packages/gameplay/src/assets/Sprite.ts`). Or `Texture2D` est une **ressource GPU** créée par le renderer (`nebula.createTexture2D`). Un script ne peut donc pas construire un `Sprite`, ni faire `addComponent(SpriteRender, ...)`.
2. **`Animator` exige des clips `Record<string, SpriteAnimation>`**, eux-mêmes construits depuis un `SpriteSheet` → `Texture2D`. Même blocage.
3. Aujourd'hui c'est la **scène** qui pose `SpriteRender` et `Animator` (`apps/sandbox/src/game/EcsScene.ts`), et le script fait `requireComponent`. Ça marche mais le script ne maîtrise pas son propre assemblage, et rien ne prépare un futur éditeur.

### Insight central

Le blocage GPU **n'est pas une limitation à contourner : c'est correct**. Un script ne doit jamais fabriquer une texture/un sprite/une animation. Exactement le modèle Unity : on ne fait pas `new Texture()` dans un `MonoBehaviour`, on reçoit une référence via `[SerializeField]`.

Il y a donc **deux contextes distincts**, séparés par responsabilité (pas par package) :

| Contexte                                                            | Responsabilité                                    | Dépendances autorisées                          |
| ------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------- |
| **Composition root** — `Scene`, futur `AssetManager`, futur éditeur | Fabriquer les ressources GPU, câbler les entités  | nebula, nexus, gameplay                         |
| **Logique de jeu** — scripts                                        | Consommer des références, décider du comportement | `@atlasjs/gameplay`, `@atlasjs/math` uniquement |

Les trois frictions ont **une seule racine** : _les scripts consomment des références d'assets, la composition root les fabrique et les injecte._ Une fois l'injection en place, (1), (2) et (3) tombent ensemble.

### Décisions de placement (actées)

- **`SpriteSheet`/`SpriteAnimation` restent physiquement dans `@atlasjs/nebula`** (domaine rendering : frames, fps, régions de texture). Elles sont atteintes via le **re-export `@atlasjs/gameplay`** déjà en place (`packages/gameplay/src/index.ts`). Le package physique ≠ le point d'entrée public : la règle de couche est satisfaite par le re-export. On ne les bouge pas (inverserait la direction de dépendance gameplay→nebula), on ne les wrappe pas (abstraction gratuite, YAGNI).
- **Une scène qui touche nebula/nexus est cohérente** : elle _est_ le composition root. La règle « gameplay+math » ne s'applique qu'à la couche logique. (Le `loadTexture` DOM privé de la scène relève du futur `AssetManager` — hors périmètre ici.)
- **Modèle d'autorité : script auteur, assets injectés.** La scène fabrique sprite + clips et les injecte ; le script pose lui-même `SpriteRender`/`Animator` dans `onCreate`.

---

## 2. Contrainte toolchain (vérifiée empiriquement)

TS 5.9, `useDefineForClassFields: true`. On utilise les **décorateurs standards stage-3** (pas `experimentalDecorators`).

Faits mesurés (probes vitest + `tsc` + build) :

1. **esbuild ne transforme PAS les décorateurs stage-3** (il les laisse passer → `SyntaxError` au runtime). **tsdown/oxc non plus.** La transformation doit donc venir de **Babel**.
2. **Solution retenue (déjà en place côté tests)** : `@rolldown/plugin-babel` + `@babel/plugin-proposal-decorators` (`version: "2023-11"`) dans `packages/gameplay/vitest.config.ts`. Vérifié : le décorateur s'exécute correctement sous vitest.
3. **Le `dist` de gameplay (tsdown) reste sain** malgré (1) : gameplay ne fait que **définir** `Expose`, il n'**applique** aucun `@decorator` dans son source → aucune syntaxe décorateur à transpiler dans le build de la lib. La syntaxe `@Expose()` n'apparaît que dans les **tests** (transpilés par babel) et les **scripts de l'app** (à transpiler par babel côté sandbox, cf. §3.5).
4. **Babel n'émet `Symbol.metadata` que si le symbole bien connu existe au runtime** — or Node ne le fournit pas → il faut un **polyfill** (`Symbol.metadata ??= Symbol.for("Symbol.metadata")`) exécuté avant toute définition de classe décorée. Une fois polyfillé, `Ctor[Symbol.metadata]` est bien peuplé (vérifié), y compris l'héritage via la chaîne de prototypes de l'objet metadata.
5. **`tsc` type-checke les décorateurs stage-3 sans `experimentalDecorators`**, mais **`lib` doit inclure `ESNext.Decorators`** (pour `Symbol.metadata` + `ClassFieldDecoratorContext.metadata`). Vérifié.
6. **`erasableSyntaxOnly` (sandbox) est compatible** avec les décorateurs stage-3 (contrairement aux legacy) → **on n'y touche pas**.

Conséquences de design :

- Un décorateur **ne peut pas** modifier le type public de la classe ni synthétiser le type du props object → le typage vient d'un **générique** `AtlasScript<TProps>`, pas du décorateur.
- **Métadonnées via `Symbol.metadata`** (approche stage-3 idiomatique), avec polyfill + gestion du piège d'héritage (cf. §3.2). Avantage : champs exposés lisibles **sans instancier** la classe → prêt pour un futur inspecteur d'éditeur.
- Pas de `emitDecoratorMetadata`/`reflect-metadata`.

---

## 3. Design

### 3.1 `AtlasScript<TProps>` générique

```ts
export abstract class AtlasScript<
  TProps extends object = {},
> implements ScriptLifecycle {
  declare readonly __props?: TProps; // phantom : sert uniquement à l'inférence de PropsOf
  // ... reste strictement inchangé
}
```

- Défaut `{}` → **100 % rétrocompatible** : tous les scripts actuels (sans props) compilent inchangés.
- `__props` est un champ fantôme (jamais assigné, `declare`) qui porte `TProps` pour que `attach` puisse l'inférer.

### 3.2 Décorateur `@Expose()` (`packages/gameplay/src/scripting/core/Expose.ts`)

Décorateur de champ **stage-3** (signature `(value, context)`), métadonnées via `context.metadata` → `Symbol.metadata`. Le polyfill `Symbol.metadata` et la lecture des métadonnées d'un constructeur sont isolés dans un module dédié `SymbolMetadata.ts`, `Expose.ts` en dépend.

```ts
// SymbolMetadata.ts
(Symbol as { metadata?: symbol }).metadata ??= Symbol.for("Symbol.metadata");

export function getCtorMetadata<T>(ctor: Function): T | undefined {
  return (ctor as { [Symbol.metadata]?: T })[Symbol.metadata];
}
```

```ts
// Expose.ts
import { getCtorMetadata } from "./SymbolMetadata";

export interface ExposeOptions {
  // vide pour l'instant — point d'accroche futur éditeur : tooltip?, range?, step?, category?
}

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

- **Polyfill en tête de `SymbolMetadata.ts` (top-level, jamais dans une fonction)** : `Symbol.metadata` n'existe pas au runtime Node ; sans lui, babel n'attache pas l'objet metadata au constructeur. Le module `SymbolMetadata.ts` étant importé (transitivement, via `Expose.ts`) avant toute classe décorée, le polyfill s'exécute d'abord (ordre d'évaluation ESM). **Le placer dans le corps de `getCtorMetadata` le ferait tourner trop tard** (à l'appel de `getExposedFields`, après la définition des classes décorées) → metadata jamais attachée. Vérifié end-to-end.
- **Sans instancier** : le décorateur s'exécute à la définition de classe et `Symbol.metadata` est posé sur le constructeur → un éditeur peut lire les champs exposés sans `new`.
- **Piège d'héritage (géré)** : `context.metadata` d'une sous-classe a l'objet metadata du parent comme **prototype**. Un `metadata[EXPOSED] ??= …` naïf trouverait le `Map` du parent par héritage et le **polluerait**. On fait donc du **clone-on-own-write** : si `EXPOSED` n'est pas une propriété **propre**, on clone la `Map` héritée (`new Map(store)`) et on la pose en propre. Résultat vérifié : `Child` = `{base, a, b}`, `Base` reste `{base}`.
- `getExposedFields` lit directement `Ctor[Symbol.metadata][EXPOSED]` (propriété propre **ou** héritée via la chaîne statique des constructeurs — une sous-classe sans `@Expose` propre hérite du metadata du parent). Retourne une **copie** (isolation de l'appelant).
- `ExposeOptions` **existe déjà mais vide** → l'éditeur pourra enrichir (`@Expose({ range: [0, 1] })`) sans casser l'API.
- Champs `private`/`readonly` (soft-private TS) autorisés. Les **`#private`** sont rejetés au runtime (`context.private`) avec un message clair.

### 3.3 `attach` typé + injection (`packages/gameplay/src/scripting/runtime/ScriptManager.ts`)

Typage : props **requis** si le script en déclare, **omis** sinon.

```ts
type PropsOf<T> = T extends AtlasScript<infer P> ? P : {};

public attach<TScript extends AtlasScript>(
  entityId: Entity,
  ScriptType: ScriptConstructor<TScript>,
  ...rest: {} extends PropsOf<TScript>
    ? [props?: PropsOf<TScript>]
    : [props: PropsOf<TScript>]
): TScript
```

Runtime, dans `attach`, **après** `new ScriptType()` + `__bindContext`, **avant** `onCreate` (garanti par la file `pendingCreate` existante — `onCreate` est différé au prochain `flushCreates`) :

```ts
private injectProps(instance: AtlasScript, ScriptType: ScriptConstructor, props?: object): void {
  if (props === undefined) return;

  const exposed: ExposedMetadata = getExposedFields(ScriptType);
  if (exposed.size === 0) return;

  const target: Record<string, unknown> = instance as unknown as Record<string, unknown>;
  const source: Record<string, unknown> = props as Record<string, unknown>;

  for (const field of exposed.keys()) {
    if (field in source) {
      target[field] = source[field];
    }
  }
}
```

- **On n'assigne que les champs exposés** (discipline) : une clé de `props` non décorée `@Expose` est ignorée (le typage l'empêche déjà normalement).
- Injection **avant `onCreate`** : le script lit ses champs injectés dans `onCreate` en toute sûreté.
- `ScriptConstructor` reste `new () => T` : la construction ne prend **aucun** argument, les props sont injectées après.

### 3.4 Exports

`packages/gameplay/src/scripting/core/index.ts` : exporter `./Expose` (`Expose`, `getExposedFields`, `ExposeOptions`, `ExposedMetadata`, `FieldDecorator`) et `./SymbolMetadata` (`getCtorMetadata`). Remontent via `scripting/index.ts` → `index.ts`, donc `import { Expose } from "@atlasjs/gameplay"`.

### 3.5 Config toolchain

Pas de `experimentalDecorators` (on reste en stage-3). Deux axes : **transformation** (babel) et **type-check** (`lib`).

**Transformation babel** (là où `@Expose()` est _appliqué_) :

- `packages/gameplay/vitest.config.ts` → **déjà fait** : `@rolldown/plugin-babel` + `@babel/plugin-proposal-decorators` (`version: "2023-11"`). Devdeps `@babel/plugin-proposal-decorators`, `@rolldown/plugin-babel` **déjà ajoutées**.
- `apps/sandbox/vite.config.ts` → **à ajouter** : le même `@rolldown/plugin-babel` + `@babel/plugin-proposal-decorators` (`version: "2023-11"`), sinon `@Expose()` dans `TestScript` → `SyntaxError` en dev/build. Vite est ici en **7** (rollup) ; le plugin s'applique quand même via le container de plugins vite (prouvé par le vitest de gameplay). Un cast `babel(...) as unknown as PluginOption` est requis car le type de retour du plugin (pensé rolldown/vite 8) est incompatible avec `PluginOption` de vite 7 — visible seulement parce que `tsc -b` du sandbox typecheck `vite.config.ts`, runtime inchangé. Ajouter les devdeps correspondantes à `apps/sandbox`.
- `dist` gameplay (tsdown) : **aucun changement** — gameplay n'applique pas de décorateur (cf. §2.3).

**Type-check `lib`** (pour `Symbol.metadata` + `ClassFieldDecoratorContext.metadata`) :

- `tsconfig.base.json` → ajouter `"ESNext.Decorators"` à `lib` (devient `["ES2022", "DOM", "ESNext.Decorators"]`). Couvre gameplay (qui hérite du base sans override de `lib`).
- `apps/sandbox/tsconfig.app.json` → ajouter `"ESNext.Decorators"` à son `lib` (il override le base : `["ES2022", "DOM", "DOM.Iterable", "ESNext.Decorators"]`). **`erasableSyntaxOnly` reste** (compatible stage-3).

Vérifs : `pnpm --filter @atlasjs/gameplay test` + `tsc --noEmit` (gameplay & sandbox), `pnpm --filter sandbox build`, et lancement dev sandbox sans `SyntaxError`.

---

## 4. Résultat côté jeu

`apps/sandbox/src/game/scripts/TestScript.ts` :

```ts
export class TestScript extends AtlasScript<{
  sprite: Sprite;
  clips: Record<string, SpriteAnimation>;
}> {
  @Expose() private readonly sprite!: Sprite;
  @Expose() private readonly clips!: Record<string, SpriteAnimation>;

  private spriteRenderer!: SpriteRendererComponent;
  private animator!: Animator;
  // ... transform, rigidbody, actions inchangés

  public onCreate(): void {
    const actions = this.addComponent(PlayerInput, controls);
    this.transform = this.addComponent(Transform2DComponent);
    this.rigidbody = this.addComponent(RigidBody2DComponent);

    this.spriteRenderer = this.addComponent(
      SpriteRendererComponent,
      this.sprite,
    );
    this.animator = this.addComponent(Animator, this.clips, "idle");
    // ... reste inchangé
  }
}
```

`apps/sandbox/src/game/EcsScene.ts` : construit `sprite` + `clips`, **ne pose plus** `SpriteRender`/`Animator`, injecte :

```ts
const blueDinoSprite: Sprite = new Sprite(blueDinoTexture);
const sheet: SpriteSheet = SpriteSheet.fromAutoGrid({
  /* ... */
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
scriptManager.attach(player1, TestScript, { sprite: blueDinoSprite, clips });
```

Les trois frictions du §1 sont résolues par **le même** mécanisme.

---

## 5. Hors périmètre (V2 → `docs/backlog.md`)

- Métadonnées d'éditeur riches dans `ExposeOptions` (tooltip, range, step, category) + inspecteur.
- Sérialisation des valeurs exposées (scène/prefab sur disque).
- Injection de services ou de composants via `@Expose` (reste `getService`/`addComponent`).
- Validation stricte de cohérence props↔metadata (champ exposé sans valeur fournie, clé fournie non exposée).
- `AssetManager` (fabrique de `Texture2D`/`Sprite` hors scène) — déjà au backlog, orthogonal.

---

## 6. Tests (TDD, harness `packages/gameplay/test/helpers/harness.ts`)

- **`@Expose` / `getExposedFields`** : enregistre les champs **sans instancier** la classe ; deux scripts distincts n'ont pas de fuite mutuelle ; l'héritage conserve les champs du parent **sans polluer** le `Map` de la base (`Child` = `{base, a, b}`, `Base` = `{base}`) ; sous-classe sans `@Expose` propre hérite quand même ; classe sans `@Expose` → `Map` vide ; la `Map` retournée est une copie ; `#private` → throw.
- **`attach` (runtime)** : injecte chaque champ exposé **avant** `onCreate` (assert dans `onCreate` que `this.sprite` est défini) ; une clé de `props` non exposée n'est jamais assignée ; script sans `TProps` → comportement inchangé, `attach(e, S)` sans 3ᵉ argument.
- **Typage** : `attach(e, TestScript)` sans props → **erreur compile** ; `attach(e, EmptyScript)` sans props → OK. (Test de type via `tsc --noEmit` sur un fichier de fixtures, ou `expectTypeOf` si dispo.)
- **Intégration** : `TestScript` reçoit `sprite` + `clips`, pose `SpriteRender` + `Animator` dans `onCreate`, l'entité rend la frame courante après quelques `frame()` (l'anim traverse jusqu'au rendu).

---

## 7. Ordre d'implémentation suggéré

1. `tsconfig.base.json` : ajouter `"ESNext.Decorators"` à `lib`. (Le babel vitest est **déjà** en place.)
2. `SymbolMetadata.ts` (polyfill top-level + `getCtorMetadata`) puis `Expose` décorateur stage-3 + `getExposedFields` (`Symbol.metadata`, clone-on-own-write) + tests unitaires.
3. `AtlasScript<TProps>` générique (+ phantom `__props`) + tests de rétrocompat (scripts existants compilent).
4. `attach` typé (`PropsOf`, tuple conditionnel) + `injectProps` + tests runtime & type.
5. Exports gameplay ; `tsc --noEmit` ; `pnpm --filter @atlasjs/gameplay build`.
6. Migrer `apps/sandbox` : babel dans `vite.config.ts` (+ devdeps), `"ESNext.Decorators"` dans `tsconfig.app.json`, `TestScript` (générique + `@Expose`), `EcsScene` (fabrique clips + `attach` avec props, retire les `addComponent` visuels).
7. Validation visuelle `apps/sandbox` (le dino s'anime, injection de bout en bout).
