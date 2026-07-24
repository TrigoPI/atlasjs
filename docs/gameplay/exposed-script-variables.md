# Variables exposées & références d'entités dans les scripts — `registerScriptMetadata` + `GameEntity` (`@atlasjs/gameplay`)

> **Statut : ✅ implémenté.** Donne à la voie scripting un mécanisme d'injection de dépendances dans les scripts, façon Unity `[SerializeField]` : le script déclare ses champs injectables via un **registre plain-JS** `registerScriptMetadata(Script, { … })`, et la composition root (scène aujourd'hui, `AssetManager`/éditeur demain) fabrique les valeurs et les fournit à `scriptManager.attach(entity, Script, props)`. Débloque la création de `SpriteRender`/`Animator` **depuis un script** (sans jamais toucher le GPU) et le passage d'**autres entités** en paramètre via le handle `GameEntity` (`sword.getComponent(Transform)`, `sword.getScript(SwordScript)`).
>
> Prérequis de lecture : `docs/gameplay/scripting-components.md` (les deux niveaux de composants, `AtlasScript`, façades, modèle `GetComponent`, `attach`), `docs/gameplay/sprite-animation.md` (`Animator`, `SpriteAnimation`), `docs/rendering/sprites.md` (`Sprite`/`Texture2D`).

---

## 1. Contexte & problème

La règle de couche est respectée : un script n'importe que `@atlasjs/gameplay` et `@atlasjs/math`. Mais plusieurs frictions bloquent l'écriture de vrais scripts de rendu et de coordination :

1. **`SpriteRender` exige un `Sprite`** à la construction, et **`Sprite` exige un `Texture2D`** (`packages/gameplay/src/assets/Sprite.ts`). Or `Texture2D` est une **ressource GPU** créée par le renderer (`nebula.createTexture2D`). Un script ne peut donc pas construire un `Sprite`, ni faire `addComponent(SpriteRender, ...)`.
2. **`Animator` exige des clips `Record<string, SpriteAnimation>`**, eux-mêmes construits depuis un `SpriteSheet` → `Texture2D`. Même blocage.
3. Aujourd'hui c'est la **scène** qui pose `SpriteRender` et `Animator` (`apps/sandbox/src/game/EcsScene.ts`), et le script fait `requireComponent`. Ça marche mais le script ne maîtrise pas son propre assemblage, et rien ne prépare un futur éditeur.
4. Un script opère **exclusivement sur sa propre entité** : il n'a aucun moyen ergonomique de recevoir une autre entité en paramètre, ni de lire/muter ses composants (`sword.getComponent(Transform)`), ni de récupérer un script attaché ailleurs (`sword.getScript(SwordScript)`). Dès qu'un comportement coordonne deux entités (un joueur qui pilote son épée), il faut tout mettre dans un seul script ou passer par des singletons/services.

### Insight central — la frontière GPU

Le blocage GPU **n'est pas une limitation à contourner : c'est correct**. Un script ne doit jamais fabriquer une texture/un sprite/une animation. Exactement le modèle Unity : on ne fait pas `new Texture()` dans un `MonoBehaviour`, on reçoit une référence via `[SerializeField]`.

Il y a donc **deux contextes distincts**, séparés par responsabilité (pas par package) :

| Contexte                                                            | Responsabilité                                    | Dépendances autorisées                          |
| ------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------- |
| **Composition root** — `Scene`, futur `AssetManager`, futur éditeur | Fabriquer les ressources GPU, câbler les entités  | nebula, nexus, gameplay                         |
| **Logique de jeu** — scripts                                        | Consommer des références, décider du comportement | `@atlasjs/gameplay`, `@atlasjs/math` uniquement |

Les frictions (1), (2), (3) ont **une seule racine** : _les scripts consomment des références (assets ou entités), la composition root les fabrique et les injecte._ Une fois l'injection en place, elles tombent ensemble ; la friction (4) est la même idée étendue aux entités (référence `GameObject` d'Unity).

### Modèle cible pour les références d'entités

Unity expose une **référence `GameObject`** dans l'inspecteur : `public GameObject sword;` puis `sword.GetComponent<T>()`. On transpose : un handle **`GameEntity`** qui wrappe `(world, entity)` (+ un résolveur de script), exposant la même surface d'accès composant que `AtlasScript` pour une entité arbitraire, plus `getScript(ScriptClass)`.

---

## 2. Décisions de placement & de design

### Placement (acté)

- **`SpriteSheet`/`SpriteAnimation` restent physiquement dans `@atlasjs/nebula`** (domaine rendering : frames, fps, régions de texture). Elles sont atteintes via le **re-export `@atlasjs/gameplay`** déjà en place (`packages/gameplay/src/index.ts`). Le package physique ≠ le point d'entrée public : la règle de couche est satisfaite par le re-export. On ne les bouge pas (inverserait la direction de dépendance gameplay→nebula), on ne les wrappe pas (abstraction gratuite, YAGNI).
- **Une scène qui touche nebula/nexus est cohérente** : elle _est_ le composition root. La règle « gameplay+math » ne s'applique qu'à la couche logique. (Le `loadTexture` DOM privé de la scène relève du futur `AssetManager` — hors périmètre ici.)
- **Modèle d'autorité : script auteur, assets injectés.** La scène fabrique sprite + clips et les injecte ; le script pose lui-même `SpriteRender`/`Animator` dans `onCreate`.

### Design du runtime (acté)

1. **Tuer Babel.** Aucune syntaxe décorateur dans les scripts : le prédécesseur `@Expose()` (décorateur stage-3 + `Symbol.metadata` + Babel) est **remplacé** par une fonction explicite `registerScriptMetadata(Script, { … })` écrite à la main. Voir §8.
2. **Schéma par champ minimal + type extensible.** Le runtime stocke ce dont il a besoin (discriminant + `required?`). `ExposeFieldMetadata` reste ouvert à l'extension : compilateur/éditeur ajouteront `kind`/`assetKind`/`runtimeType`/`tooltip`/… sans casser l'API. On ne fige **pas** de schéma éditeur spéculatif.
3. **Validation = warn minimal.** `injectProps` émet un `logger.warn` si un champ `required` n'a pas de valeur, ou si une clé de `props` n'est pas exposée. **Jamais de throw** (ne casse pas le jeu). Le reste (éditeur, throw strict) reste au backlog.
4. **Héritage fusionné.** `getScriptMetadata(Child)` fusionne les métadonnées parent→enfant via la chaîne de prototypes des constructeurs, sans piège de pollution.
5. **Pas de nouveau package.** Le code reste dans `@atlasjs/gameplay` (`scripting/core`). La discipline de découplage (`scripting/core`+`runtime` ne dépendent que des packages **foundational** `@atlasjs/nexus`, `@atlasjs/core` et `@atlasjs/utils` — ce dernier pour le logging) est maintenue pour rendre une future extraction `@atlasjs/scripting` triviale, mais l'extraction n'est **pas** faite ici (YAGNI : un seul consommateur aujourd'hui).

### Design des références d'entités (acté)

6. **`getScript` séparé, pas de `getComponent` unifié.** Récupérer un script se fait via `entity.getScript(SwordScript)`, **pas** via une surcharge de `getComponent`. Composants ECS (Nexus) et scripts (`ScriptManager`) restent deux sous-systèmes distincts — les mélanger forcerait un sniffing de constructeur (`Ctor.prototype instanceof AtlasScript`) et coupler l'accès composant au `ScriptManager`, en violation de la règle des 2 niveaux.
7. **Bag de props plat + typage mappé.** On garde l'appel `attach(entity, Script, { … })` **plat** (pas de sous-bag `{ exposed, entities }`). Un champ entité est typé `GameEntity` **dans le script**, mais accepté comme `Entity` brute **au call site** via le type mappé `AttachProps`. `injectProps` wrappe la `Entity` reçue en `GameEntity` avant l'assignation.
8. **Handle stateless.** `GameEntity` ne cache **aucune donnée composant** : il re-résout à chaque appel (règle « façades stateless »). Il ne porte que l'identité `(world, entity, resolver)`. Entité détruite → `getComponent`/`getScript` renvoient `undefined`, jamais de crash.
9. **Pas de cycle de packages/couches.** `GameEntity` vit dans `scripting/core` et dépend d'une **interface** `ScriptResolver` (core), pas du `ScriptManager` concret (runtime). `ScriptManager` implémente `ScriptResolver`. La direction `runtime → core` est préservée.
10. **Réutilisation, pas duplication (du corps).** Le **corps** du dispatch token/composant vit **une seule fois** (dans `GameEntity`) ; `RuntimeScriptContext` délègue son propre accès composant à un `GameEntity` de sa propre entité. Les **signatures** d'overloads restent déclarées sur chaque surface (un impl à signature large ne satisfait pas des overloads à retour typé).

---

## 3. Registre de métadonnées

### API publique — `scripting/core/ScriptMetadata.ts`

```ts
export function registerScriptMetadata(
  ctor: Function,
  metadata: ScriptMetadata,
): void;

export function getScriptMetadata(ctor: Function): ScriptMetadata | undefined;

export function getExposedFields(
  ctor: Function,
): Map<string, ExposeFieldMetadata>;
```

- `registerScriptMetadata` écrit l'entrée **propre** du constructeur dans le registre (uniquement les champs déclarés par cette classe).
- `getScriptMetadata` retourne la métadonnée **fusionnée** (héritage inclus, cf. plus bas), ou `undefined` si aucun ancêtre n'a de metadata.
- `getExposedFields` est une commodité au-dessus de `getScriptMetadata` : retourne une **copie** (`Map`) des champs exposés fusionnés (isolation de l'appelant). Utile aux tests et aux consommateurs externes (futur éditeur) ; `ScriptManager.injectProps` consomme directement `getScriptMetadata` (il lui faut `required` et `type`).

### Registre

```ts
const REGISTRY: WeakMap<Function, ScriptMetadata> = new WeakMap();
```

- Backing store module-local, **clés = constructeurs**. `WeakMap` → pas de fuite mémoire (une classe déchargée libère son entrée).
- **Pas de `Symbol` partagé writer↔reader** : `registerScriptMetadata` et `getScriptMetadata` sont deux fonctions du même module, elles partagent le `REGISTRY` tant qu'un consommateur les importe depuis `@atlasjs/gameplay`. (Le risque théorique « deux copies du module gameplay » demeure comme pour n'importe quel singleton de module — c'est le cas nominal d'un package publié.)

### Héritage (fusion parent→enfant)

`getScriptMetadata(ctor)` remonte la chaîne statique des constructeurs et fusionne :

```ts
export function getScriptMetadata(ctor: Function): ScriptMetadata | undefined {
  const chain: Function[] = [];
  let current: Function | null = ctor;
  while (current && current !== Function.prototype) {
    chain.push(current);
    current = Object.getPrototypeOf(current);
  }

  let merged: Record<string, ExposeFieldMetadata> | undefined;
  // du plus ancêtre au plus dérivé : l'enfant écrase le parent par champ
  for (let i = chain.length - 1; i >= 0; i--) {
    const own: ScriptMetadata | undefined = REGISTRY.get(chain[i]);
    if (own === undefined) continue;
    merged = { ...(merged ?? {}), ...own.exposed };
  }

  return merged === undefined ? undefined : { exposed: merged };
}
```

- `Child` hérite des champs de `Base` ; `Base` n'est **jamais** pollué (chaque ctor a son entrée propre isolée dans le `WeakMap`) ; `GrandChild` fusionne toute la chaîne ; une sous-classe sans metadata propre hérite du parent.
- La fusion est calculée **à la lecture**, jamais écrite dans le store.
- Écrasement **par champ** (l'enfant peut redéclarer un champ du parent avec d'autres options).

---

## 4. Métadonnée de champ (union discriminée) & builders

`ExposeFieldMetadata` est une **union discriminée** sur `type`, extensible pour les kinds futurs (asset, range…) du backlog :

```ts
// prettier-ignore
export type ExposeFieldMetadata =
  | { type: "field";  required?: boolean }
  | { type: "entity"; required?: boolean };

export interface ScriptMetadata {
  exposed: Record<string, ExposeFieldMetadata>;
}
```

Builders d'authoring, **namespacés** sur `ScriptMetadata` par déclaration-merging (interface en espace de type + `const` homonyme en espace de valeur — pas de mot-clé `namespace`), dans le même esprit que `button()`/`vector2()` côté input. Ils posent toujours le discriminant :

```ts
// prettier-ignore
export const ScriptMetadata = {
  field(options: { required?: boolean } = {}): ExposeFieldMetadata {
    return { type: "field", required: options.required };
  },
  entity(options: { required?: boolean } = {}): ExposeFieldMetadata {
    return { type: "entity", required: options.required };
  },
};
```

Usage :

```ts
registerScriptMetadata(TestScript, {
  exposed: {
    speed: ScriptMetadata.field({ required: true }),
    sword: ScriptMetadata.entity({ required: true }),
  },
});
```

`registerScriptMetadata`/`getScriptMetadata` (merge d'héritage) copient les entrées telles quelles, quel que soit le `type`.

---

## 5. `AtlasScript<TProps>` + `attach` typé

### `AtlasScript<TProps>` générique

```ts
export abstract class AtlasScript<
  TProps extends object = {},
> implements ScriptLifecycle {
  declare readonly __props?: TProps; // phantom : sert uniquement à l'inférence de PropsOf
  // ... reste inchangé
}
```

- Défaut `{}` → **100 % rétrocompatible** : tous les scripts sans props compilent inchangés.
- `__props` est un champ fantôme (jamais assigné, `declare`) qui porte `TProps` pour que `attach` puisse l'inférer.

### `attach` typé + typage mappé des entités

Props **requis** si le script en déclare, **omis** sinon. Un champ entité est typé `GameEntity` dans le `TProps` du script ; au call site d'`attach`, le type mappé `AttachProps` le ramène à `Entity` :

```ts
// scripting/runtime/ScriptManager.ts
type AttachProps<P> = { [K in keyof P]: P[K] extends GameEntity ? Entity : P[K] };

type PropsOf<T> = T extends AtlasScript<infer P> ? P : {};
type PropsOfArgs<T> =
  {} extends AttachProps<PropsOf<T>>
    ? [props?: AttachProps<PropsOf<T>>]
    : [props: AttachProps<PropsOf<T>>];

public attach<TScript extends AtlasScript>(
  entityId: Entity,
  ScriptType: ScriptConstructor<TScript>,
  ...rest: PropsOfArgs<TScript>
): TScript
```

- `GameEntity` étant une interface riche en méthodes, aucune valeur « champ » (nombre, objet POJO) ne matche `extends GameEntity` — la substitution ne cible **que** les champs entité. Symétriquement, `Entity` (`number & brand`) ne matche pas `GameEntity`, donc au call site on passe bien une `Entity`.
- `ScriptConstructor` reste `new () => T` : la construction ne prend **aucun** argument, les props sont injectées après.

---

## 6. Injection + validation

Runtime, dans `attach`, **après** `new ScriptType()` + `__bindContext`, **avant** `onCreate` (garanti par la file `pendingCreate` — `onCreate` est différé au prochain `flushCreates`). `ScriptManager` possède un `Logger` (`createLogger("ScriptManager")`). `injectProps` dispatch sur `meta.type` :

```ts
private injectProps(
  instance: AtlasScript,
  ScriptType: ScriptConstructor,
  props?: object,
): void {
  const metadata: ScriptMetadata | undefined = getScriptMetadata(ScriptType);
  const exposed: Record<string, ExposeFieldMetadata> = metadata?.exposed ?? {};
  const source: Record<string, unknown> = (props ?? {}) as Record<string, unknown>;
  const target: Record<string, unknown> = instance as unknown as Record<string, unknown>;

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

  for (const key in source) {
    if (!(key in exposed)) {
      this.logger.warn(
        `prop "${key}" provided to "${ScriptType.name}" is not exposed and was ignored.`,
      );
    }
  }
}
```

- **On n'assigne que les champs exposés** ; une clé de `props` non exposée est ignorée **et signalée**.
- Un champ `type: "entity"` est **wrappé** en `GameEntity` (le `this` passé à `createGameEntity` est le `ScriptManager` lui-même, qui satisfait `ScriptResolver`) ; un champ `field` est assigné tel quel.
- **Warn, jamais throw** : (a) un champ `required` sans valeur ; (b) une clé fournie non exposée.
- **Cas nominal silencieux** : script sans metadata et sans props (`attach(e, Script)`) → `exposed = {}`, `source = {}`, aucun warn.
- Injection **avant `onCreate`** : le script lit ses champs injectés dans `onCreate` en toute sûreté.

---

## 7. Le handle `GameEntity` & `ScriptResolver`

### Interface & résolveur — `scripting/core/GameEntity.ts`

Surface d'accès composant identique à `AtlasScript`, plus `getScript` :

```ts
import { Component, Entity, NexusWorld } from "@atlasjs/nexus";

import { AtlasScript } from "./AtlasScript";
import { ScriptConstructor } from "./core-types";
import { ScriptComponentToken } from "./ScriptComponentToken";

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
```

Le résolveur de script (interface core, pour éviter le cycle `core → runtime`) :

```ts
// prettier-ignore
export interface ScriptResolver {
  getScript<T extends AtlasScript>(entity: Entity, type: ScriptConstructor<T>): T | undefined;
}
```

Factory (implémentation **unique** du dispatch token/composant, réutilisée par `RuntimeScriptContext`) :

```ts
// prettier-ignore
export function createGameEntity(entity: Entity, world: NexusWorld, scripts: ScriptResolver): GameEntity {
  const api: GameEntity = {
    get id(): Entity {
      return entity;
    },

    hasComponent(type): boolean {
      return world.hasComponent(entity, isScriptComponentToken(type) ? type.engine : type);
    },

    getComponent(type): unknown {
      if (isScriptComponentToken(type)) {
        return world.hasComponent(entity, type.engine) ? type.create(world, entity) : undefined;
      }
      return world.getComponent(entity, type);
    },

    addComponent(type, ...args: any[]): unknown {
      if (isScriptComponentToken(type)) {
        if (!world.hasComponent(entity, type.engine)) {
          world.addComponent(entity, type.engine, ...args);
        }
        return type.create(world, entity);
      }
      const existing: object | undefined = world.getComponent(entity, type);
      return existing !== undefined ? existing : world.addComponent(entity, type, ...args);
    },

    removeComponent(type): void {
      world.removeComponent(entity, isScriptComponentToken(type) ? type.engine : type);
    },

    requireComponent(type): unknown {
      const component: unknown = api.getComponent(type as Component<object, any[]>);
      if (component === undefined) {
        const name: string = isScriptComponentToken(type) ? type.engine.name : (type as Component).name;
        throw new Error(`[GameEntity] Required component "${name}" is missing on entity "${entity}".`);
      }
      return component;
    },

    getScript(type): unknown {
      return scripts.getScript(entity, type);
    },
  } as GameEntity;

  return api;
}
```

> Ce corps est **le** dispatch token/composant, celui qui vivait autrefois dans `RuntimeScriptContext`. Après ce refactor, `RuntimeScriptContext` ne le duplique plus (délégation ci-dessous).

### `getScript` côté `ScriptManager` — `scripting/runtime/ScriptManager.ts`

`ScriptManager` implémente `ScriptResolver`. Il balaie les records de l'entité et renvoie la première instance `instanceof type` (parité Unity : les sous-classes matchent ; ignore les records `isDestroyed`) :

```ts
public getScript<T extends AtlasScript>(entity: Entity, type: ScriptConstructor<T>): T | undefined {
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

### Délégation `RuntimeScriptContext` + `AtlasScript.getEntity`

`RuntimeScriptContext` reçoit désormais le `ScriptResolver` (le `ScriptManager`, passé par `this` à la construction) et construit **un** `GameEntity` de sa propre entité auquel il forwarde l'accès composant :

```ts
// scripting/runtime/RuntimeScriptContext.ts (schéma)
export class RuntimeScriptContext implements ScriptContext {
  private readonly self: GameEntity;
  // …
  public constructor(entity: Entity, world: NexusWorld, services: ServiceRegistry, scripts: ScriptResolver) {
    this.self = createGameEntity(entity, world, scripts);
    // … stocke aussi world + scripts (pour getEntity) et services + entity (pour getService/getEntityId)
  }
  public getComponent(type: any): unknown { return this.self.getComponent(type); }
  public addComponent(type: any, ...args: any[]): unknown { return this.self.addComponent(type, ...args); }
  public hasComponent(type: any): boolean { return this.self.hasComponent(type); }
  public removeComponent(type: any): void { this.self.removeComponent(type); }
  public getEntity(entity: Entity): GameEntity { return createGameEntity(entity, this.world, this.scripts); }
  // getService / getEntityId : inchangés
}
```

- **`ScriptContext` (interface core)** gagne `getEntity(entity: Entity): GameEntity`.
- **`AtlasScript`** gagne un passthrough `public getEntity(entity: Entity): GameEntity { return this.context.getEntity(entity); }`, pour wrapper une `Entity` obtenue au runtime (résultat de `world.query`, d'un raycast futur, etc.) — ce qui subsume aussi un « handle de soi-même » (`this.getEntity(this.entityId)`).
- **`ScriptManager.attach`** passe `this` en 4ᵉ argument du `RuntimeScriptContext`.

---

## 8. Toolchain (sans Babel / sans décorateurs)

Le prédécesseur de ce système était `@Expose()` — un décorateur de champ **stage-3** portant ses métadonnées via `Symbol.metadata`, qui imposait Babel (`@rolldown/plugin-babel` + `@babel/plugin-proposal-decorators`) dans vitest **et** dans chaque application, un polyfill `Symbol.metadata` top-level fragile, et une gestion clone-on-own-write du piège d'héritage. Il a été **entièrement remplacé** par le registre `registerScriptMetadata` (les fichiers `Expose.ts` et `SymbolMetadata.ts` ont été supprimés).

État final : **aucun décorateur nulle part**, donc **aucune chaîne Babel**.

- `packages/gameplay/vitest.config.ts` / `apps/sandbox/vite.config.ts` : plus de plugin `@rolldown/plugin-babel` ; `react()` reste côté sandbox.
- `package.json` (gameplay & sandbox) : plus de devdeps `@babel/plugin-proposal-decorators` / `@rolldown/plugin-babel`.
- `tsconfig.base.json` & `apps/sandbox/tsconfig.app.json` : `"ESNext.Decorators"` dans `lib` est devenu inutile mais **laissé en place, inerte** (inoffensif, `Symbol.metadata` peut rester référencé par d'autres libs ; retrait optionnel, non bloquant). `erasableSyntaxOnly` (sandbox) est conservé.
- Le `dist` de gameplay (tsdown) ne change pas de nature : gameplay n'appliquait déjà aucun décorateur dans son source — la seule différence est qu'il n'y a plus de décorateur du tout.

---

## 9. Exemple complet (sandbox)

**`apps/sandbox/src/game/scripts/TestScript.ts`** — reçoit ses assets **et** l'entité `sword`, et la pilote :

```ts
export class TestScript extends AtlasScript<{
  sprite: Sprite;
  clips: Record<string, SpriteAnimation>;
  speed: number;
  controls: PlayerControlsDescriptor;
  sword: GameEntity;                      // handle dans le script
}> {
  private readonly sprite!: Sprite;
  private readonly clips!: Record<string, SpriteAnimation>;
  private readonly speed!: number;
  private readonly controls!: PlayerControlsDescriptor;
  private readonly sword!: GameEntity;

  private spriteRenderer!: SpriteRendererComponent;
  private animator!: Animator;
  // … transform, rigidbody, actions

  public onCreate(): void {
    const actions = this.addComponent(PlayerInput, this.controls);
    this.transform = this.addComponent(Transform2DComponent);
    this.rigidbody = this.addComponent(RigidBody2DComponent);

    this.spriteRenderer = this.addComponent(SpriteRendererComponent, this.sprite);
    this.animator = this.addComponent(Animator, this.clips, "idle");

    const swordScript: SwordScript | undefined = this.sword.getScript(SwordScript);
    const swordTransform: Transform = this.sword.requireComponent(Transform);
    // pilotage de l'épée depuis ici
  }
}

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

**`apps/sandbox/src/game/EcsScene.ts`** — fabrique les assets, ne pose plus `SpriteRender`/`Animator`, et passe l'entité `sword` **brute** :

```ts
const blueDinoSprite: Sprite = new Sprite(blueDinoTexture);
const sheet: SpriteSheet = SpriteSheet.fromAutoGrid({ /* ... */ });
const clips: Record<string, SpriteAnimation> = {
  idle: new SpriteAnimation({
    frames: sheet.getManyInRange("blue_dino_", 0, 3),
    fps: 5, loop: true, autoPlay: true,
  }),
  run: new SpriteAnimation({
    frames: sheet.getManyInRange("blue_dino_", 4, 9),
    fps: 12, loop: true, autoPlay: true,
  }),
};

const player: Entity = nexus.createEntity();
const sword: Entity = nexus.createEntity();

scriptManager.attach(player, TestScript, {
  clips,
  controls,
  sprite: blueDinoSprite,
  speed: 250,
  sword,                                  // Entity brute — injectProps la wrappe en GameEntity
});
```

Toutes les frictions du §1 sont résolues par **le même** mécanisme d'injection.

---

## 10. Caveats assumés

- **Ordre de création vs `onCreate`.** `getScript` renvoie l'instance dès qu'elle est enregistrée, y compris avant que son `onCreate` ait tourné (record en attente). Dans un même flush, l'ordre d'`attach` = l'ordre de `flushCreates`, donc référencer une entité attachée **avant** soi et lire ses champs dans `onCreate` est sûr ; l'inverse (lire dans `onCreate` les champs d'un script attaché après) peut voir des champs non initialisés. Recommandation : lire les états d'autres scripts dans `onUpdate`, pas `onCreate`.
- **Staleness / entité détruite.** Le handle est stateless : si l'entité est détruite, `getComponent`/`getScript` renvoient `undefined` et `requireComponent` throw (cohérent avec le contrat façade). Le champ `this.sword` continue de pointer un handle valide en objet mais « vide » côté monde — pas de dangling data.
- **Désync `TProps` ↔ metadata.** Un champ injectable est déclaré **deux fois** : dans le générique `AtlasScript<{ … }>` (type de `attach`) **et** dans `registerScriptMetadata` (runtime), sans lien automatique — y compris l'accord `GameEntity` (type au call site) ↔ `ScriptMetadata.entity()` (wrapping runtime), et `required`. C'est inhérent tant que le compilateur custom n'existe pas ; il générera les deux à terme.
- **`GameEntity` DOIT être importé en `import type`.** Dans les fichiers d'app/scripts (`TestScript.ts`, etc.), `GameEntity` n'est qu'un type — un import de **valeur** (`import { GameEntity }`) passe `tsc --noEmit` (il est effacé au type-check) mais **casse au runtime** sous Vite/esbuild : `SyntaxError: The requested module '@atlasjs/gameplay' does not provide an export named 'GameEntity'` → écran noir React. Toujours `import type { GameEntity } from "@atlasjs/gameplay";`. À vérifier au navigateur, pas seulement au `tsc`.

---

## 11. Hors périmètre (V2 → `docs/backlog.md`)

- **Métadonnées d'éditeur riches** dans `ExposeFieldMetadata` (`kind`, `assetKind`, `runtimeType`, `tooltip`, `range`, `step`, `category`, contrainte de composant requis type Unity `[RequireComponent]`) + inspecteur — l'union discriminée est ouverte à l'extension mais aucun schéma spéculatif n'est figé ; elles seront **générées par le compilateur**.
- **Compilateur TypeScript custom** (réécriture `addComponent<T>(a, b)` → `addComponent(T, a, b)`, génération de `registerScriptMetadata`, lien automatique `TProps` ↔ metadata, réintroduction de `@Expose()` comme pur marqueur compile-time) — projet distinct, futur.
- **(Dé)sérialisation** des valeurs exposées et des refs d'entité (scène/prefab sur disque) — les refs demandent des ids d'entité stables cross-session, à lier au chantier `AssetRef` par id du backlog assets.
- **Validation stricte avec throw** ; **inspecteur d'éditeur**.
- **Champs entité optionnels** (`sword?: GameEntity`) et **tableaux** (`GameEntity[]`) : le type mappé `AttachProps` ne les substitue pas encore (une union `GameEntity | undefined` ou un `GameEntity[]` ne matche pas `extends GameEntity`). À généraliser (`NonNullable`, mapping récursif) sur besoin concret.
- **`getScripts(type)` pluriel** (toutes les instances d'un type sur une entité) — `getScript` singulier suffit au besoin actuel.
- **Injection de services ou de composants via metadata** (reste `getService`/`addComponent`).
- **`AssetManager`** (fabrique de `Texture2D`/`Sprite` hors scène) — déjà au backlog, orthogonal.
- **Extraction `@atlasjs/scripting`** — déclenchée le jour où l'éditeur/compilateur devient un consommateur hors gameplay ; discipline de découplage maintenue d'ici là.
