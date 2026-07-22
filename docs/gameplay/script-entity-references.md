# Références d'entités dans les scripts — `GameEntity` (`@atlasjs/gameplay`)

> **Statut : ✅ implémenté** (branche `claude/feat/game-entity-references`, commits `0983199..79d04ba` ; SDD 6 tâches, review finale opus « Ready to merge », gameplay 131/131 + `tsc` clean, sandbox vérifiée live dans le navigateur). Ajoute au scripting la capacité de **passer une autre entité en paramètre d'un script** (façon référence `GameObject` d'Unity) et d'**opérer dessus** : `otherEntity.getComponent(Component)`, `otherEntity.getScript(SwordScript)`. Introduit un handle stateless `GameEntity` qui wrappe `(world, entity)` + résolution de script, un champ `entity` dans la métadonnée de script, et un typage call-site qui accepte une `Entity` brute là où le script voit un `GameEntity`.
>
> Prérequis de lecture : [`scripting-components.md`](scripting-components.md) (modèle `GetComponent`, façades/tokens, `attach`), [`script-metadata-registry.md`](script-metadata-registry.md) (`registerScriptMetadata`, `ExposeFieldMetadata`, `injectProps`), [`scripting-component-unification.md`](scripting-component-unification.md) (règle façade/raw, `defineScriptComponent`).

---

## 1. Contexte & motivation

Un script `AtlasScript` opère aujourd'hui **exclusivement sur sa propre entité**. Toute la surface d'accès composant (`getComponent`/`addComponent`/`hasComponent`/`removeComponent`/`requireComponent`) route vers `this.entity` via `RuntimeScriptContext`. Un script n'a aucun moyen ergonomique :

1. de **recevoir une autre entité en paramètre** (les props n'acceptent aujourd'hui que des valeurs « champ » assignées telles quelles, et `Entity` n'est qu'un `number & brand` sans surface) ;
2. de **lire/muter les composants d'une autre entité** (`sword.getComponent(Transform)`) ;
3. de **récupérer l'instance d'un script attaché à une autre entité** (`sword.getScript(SwordScript)`).

C'est un manque structurel : dès qu'un comportement coordonne deux entités (un joueur qui pilote son épée), il faut aujourd'hui tout mettre dans un seul script sur une seule entité, ou passer par des singletons/services. L'usage concret qui a révélé le manque : dans [`SwordScript`](../../apps/sandbox/src/game/scripts/SwordScript.ts), on aimerait piloter l'épée **depuis** [`TestScript`](../../apps/sandbox/src/game/scripts/TestScript.ts) en lui passant l'entité `sword`.

### Modèle cible

Unity résout ça avec une **référence `GameObject`** exposée dans l'inspecteur : `public GameObject sword;` puis `sword.GetComponent<T>()`. On transpose : un handle **`GameEntity`** qui wrappe `(world, entity)` (+ un résolveur de script), exposant la même surface d'accès composant que `AtlasScript` mais pour une entité arbitraire, plus `getScript(ScriptClass)`.

### Décisions actées (ce document)

1. **`getScript` séparé, pas de `getComponent` unifié.** Récupérer un script se fait via `entity.getScript(SwordScript)`, **pas** via une surcharge de `getComponent`. Les composants ECS (Nexus) et les scripts (`ScriptManager`) restent deux sous-systèmes distincts — les mélanger dans `getComponent` forcerait un sniffing de constructeur (`Ctor.prototype instanceof AtlasScript`) et coupler l'accès composant au `ScriptManager`, en violation de la règle des 2 niveaux (CLAUDE.md package).
2. **Bag de props plat + typage mappé.** On garde l'appel `attach(entity, Script, { … })` **plat** (pas de sous-bag `{ exposed, entities }`). Un champ entité est typé `GameEntity` **dans le script**, mais accepté comme `Entity` brute **au call site** via un type conditionnel `AttachProps`. `injectProps` wrappe la `Entity` reçue en `GameEntity` avant l'assignation.
3. **Métadonnée en union discriminée + builders `ScriptMetadata.field()`/`.entity()`.** `ExposeFieldMetadata` devient une union taggée sur `type` (`"field" | "entity"`), extensible pour les kinds futurs (asset, range…) du backlog. L'authoring passe par deux builders namespacés sur `ScriptMetadata` (mêmes esprit que `button()`/`vector2()` côté input) qui posent toujours le discriminant.
4. **Handle stateless.** `GameEntity` ne cache **aucune donnée composant** : il re-résout à chaque appel (règle « façades stateless »). Il ne porte que l'identité `(world, entity, resolver)`. Entité détruite → `getComponent`/`getScript` renvoient `undefined`, jamais de crash.
5. **Pas de cycle de packages/couches.** `GameEntity` vit dans `scripting/core` et dépend d'une **interface** `ScriptResolver` (core), pas du `ScriptManager` concret (runtime). `ScriptManager` implémente `ScriptResolver`. La direction de dépendance `runtime → core` est préservée.
6. **Réutilisation, pas duplication (du corps).** Le **corps** du dispatch token/composant vit **une seule fois** (dans `GameEntity`) ; `RuntimeScriptContext` délègue son propre accès composant à un `GameEntity` de sa propre entité. Atténue la « triple duplication des overloads `addComponent` » notée au backlog **côté implémentation** — les **signatures** d'overloads restent déclarées sur chaque surface (`GameEntity`, `ScriptContext`, `RuntimeScriptContext`, `AtlasScript`), car un impl à signature large ne satisfait pas des overloads à retour typé.

---

## 2. Design

### 2.1 Le handle `GameEntity` — `scripting/core/GameEntity.ts` (nouveau)

Interface publique (surface d'accès composant identique à `AtlasScript`, plus `getScript`) :

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

Factory (implémentation unique du dispatch token/composant, réutilisée par `RuntimeScriptContext`) :

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

> Le corps ci-dessus est **le** dispatch token/composant, identique à celui qui vit aujourd'hui dans `RuntimeScriptContext`. Après ce refactor, `RuntimeScriptContext` ne le duplique plus (cf. §2.5).

### 2.2 `getScript` côté `ScriptManager` — `scripting/runtime/ScriptManager.ts`

`ScriptManager` implémente `ScriptResolver`. Nouvelle méthode qui balaie les records de l'entité et renvoie la première instance `instanceof type` (parité Unity : les sous-classes matchent ; ignore les records `isDestroyed`) :

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

### 2.3 Métadonnée en union discriminée — `scripting/core/ScriptMetadata.ts`

`ExposeFieldMetadata` passe d'une interface plate à une **union discriminée** sur `type` :

```ts
// prettier-ignore
export type ExposeFieldMetadata =
  | { type: "field";  required?: boolean }
  | { type: "entity"; required?: boolean };

export interface ScriptMetadata {
  exposed: Record<string, ExposeFieldMetadata>;
}
```

Builders d'authoring, **namespacés** sur `ScriptMetadata` par déclaration-merging (interface en espace de type + `const` homonyme en espace de valeur — pas de mot-clé `namespace`) :

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

`registerScriptMetadata`/`getScriptMetadata` (merge d'héritage) sont **inchangés** : ils copient les entrées telles quelles, quel que soit le `type`.

### 2.4 Passage au call site (typage mappé) + `injectProps`

**Typage.** Un champ entité est typé `GameEntity` dans le `TProps` du script ; au call site d'`attach`, un type conditionnel le ramène à `Entity` :

```ts
// scripting/runtime/ScriptManager.ts
type AttachProps<P> = { [K in keyof P]: P[K] extends GameEntity ? Entity : P[K] };

type PropsOf<T> = T extends AtlasScript<infer P> ? P : {};
type PropsOfArgs<T> =
  {} extends AttachProps<PropsOf<T>>
    ? [props?: AttachProps<PropsOf<T>>]
    : [props: AttachProps<PropsOf<T>>];
```

`GameEntity` étant une interface riche en méthodes, aucune valeur « champ » (nombre, objet POJO) ne matche `extends GameEntity` — la substitution ne cible **que** les champs entité. Symétriquement, `Entity` (`number & brand`) ne matche pas `GameEntity`, donc au call site on passe bien une `Entity`.

**Runtime.** `injectProps` dispatch sur `meta.type` :

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

(La boucle de warn « clé fournie non exposée » reste inchangée.) `this` passé à `createGameEntity` est le `ScriptManager` lui-même (il satisfait `ScriptResolver`).

### 2.5 Réutilisation interne + wrapping runtime

**`RuntimeScriptContext` délègue.** Le contexte reçoit désormais le `ScriptResolver` (le `ScriptManager`, passé par `this` à la construction) et construit **un** `GameEntity` de sa propre entité auquel il forwarde l'accès composant. Le dispatch token/composant ne vit plus qu'une fois (dans `createGameEntity`).

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

**`ScriptContext` (interface core)** gagne `getEntity(entity: Entity): GameEntity`. **`AtlasScript`** gagne un passthrough `public getEntity(entity: Entity): GameEntity { return this.context.getEntity(entity); }`, pour wrapper une `Entity` obtenue au runtime (résultat de `world.query`, d'un raycast futur, etc.) — ce qui subsume aussi un éventuel « handle de soi-même » (`this.getEntity(this.entityId)`).

**`ScriptManager.attach`** passe `this` en 4ᵉ argument du `RuntimeScriptContext`.

---

## 3. Exemple complet (sandbox)

**`TestScript`** — reçoit `sword` et la pilote :

```ts
export class TestScript extends AtlasScript<{
  sprite: Sprite;
  speed: number;
  controls: PlayerControlsDescriptor;
  clips: Record<string, SpriteAnimation>;
  sword: GameEntity;                      // handle dans le script
}> {
  private sword: GameEntity;
  // …
  public onCreate(): void {
    // …
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

**`EcsScene`** — passe la `Entity` brute :

```ts
scriptManager.attach(player, TestScript, {
  clips,
  controls,
  sprite: blueDinoSprite,
  speed: 250,
  sword,                                  // Entity brute — injectProps la wrappe
});
```

---

## 4. Caveats assumés

- **Ordre de création vs `onCreate`.** `getScript` renvoie l'instance dès qu'elle est enregistrée, y compris avant que son `onCreate` ait tourné (record en attente). Dans un même flush, l'ordre d'`attach` = l'ordre de `flushCreates`, donc référencer une entité attachée **avant** soi et lire ses champs dans `onCreate` est sûr ; l'inverse (lire dans `onCreate` les champs d'un script attaché après) peut voir des champs non initialisés. Recommandation : lire les états d'autres scripts dans `onUpdate`, pas `onCreate`.
- **Staleness / entité détruite.** Le handle est stateless : si l'entité est détruite, `getComponent`/`getScript` renvoient `undefined` et `requireComponent` throw (cohérent avec le contrat façade actuel). Le champ `this.sword` continue de pointer un handle valide en objet, mais « vide » côté monde — pas de dangling data.
- **Désync `TProps` ↔ metadata.** Un champ doit être typé `GameEntity` **et** déclaré `ScriptMetadata.entity()` ; les deux signaux (type au call site, wrapping au runtime) doivent s'accorder à la main. C'est la **même** désync déjà documentée pour `required` (backlog « Variables exposées ») — sera auto-liée par le futur compilateur custom, pas résolue ici.

---

## 5. Non-objectifs V1 (→ backlog)

- **Champs entité optionnels** (`sword?: GameEntity`) et **tableaux** (`GameEntity[]`, `readonly GameEntity[]`) : le type conditionnel `AttachProps` ne les substitue pas encore (une union `GameEntity | undefined` ou un `GameEntity[]` ne matche pas `extends GameEntity`). À généraliser (`NonNullable`, mapping récursif sur les tableaux) sur besoin concret.
- **(Dé)sérialisation des refs d'entité** (scène/prefab sur disque) : demande des ids d'entité stables cross-session, à lier au chantier `AssetRef` par id du backlog assets.
- **Métadonnée éditeur riche** sur les refs (`kind`, contrainte de composant requis type Unity `[RequireComponent]`, tooltip…) : l'union discriminée est ouverte à l'extension, mais aucun schéma spéculatif n'est figé ici.
- **`getScripts(type)` pluriel** (toutes les instances d'un type sur une entité) : `getScript` singulier suffit au besoin actuel.

---

## 6. Fichiers touchés & plan de test

**Nouveaux :**

- `packages/gameplay/src/scripting/core/GameEntity.ts` — interface `GameEntity`, interface `ScriptResolver`, factory `createGameEntity`.

**Modifiés (packages) :**

- `scripting/core/ScriptMetadata.ts` — union `ExposeFieldMetadata` + `const ScriptMetadata` (builders `field`/`entity`).
- `scripting/core/ScriptContext.ts` — ajoute `getEntity(entity): GameEntity`.
- `scripting/core/AtlasScript.ts` — passthrough `getEntity`.
- `scripting/core/index.ts` — export `GameEntity`, `createGameEntity`, `ScriptResolver`.
- `scripting/runtime/RuntimeScriptContext.ts` — 4ᵉ param `ScriptResolver`, délégation à `self: GameEntity`, impl `getEntity`.
- `scripting/runtime/ScriptManager.ts` — impl `ScriptResolver.getScript`, `injectProps` (dispatch `type`), `AttachProps`/`PropsOfArgs`, passe `this` au contexte.

**Modifiés (sandbox) :**

- `apps/sandbox/src/game/scripts/{TestScript,SwordScript,WallScript}.ts` — metadata via `ScriptMetadata.field()/.entity()` ; `TestScript` reçoit `sword: GameEntity`.
- `apps/sandbox/src/game/EcsScene.ts` — passe `sword` (Entity) à `TestScript`.

**Tests (`test/helpers/harness.ts`) :**

- Injecter une ref → `this.sword.getComponent(X)` renvoie le composant de l'autre entité ; `getScript(Other)` renvoie l'instance.
- `getScript` d'un type absent → `undefined` ; d'une entité détruite → `undefined`.
- `ScriptMetadata.entity({ required: true })` sans valeur fournie → `logger.warn`, pas de throw.
- Régression : les champs `field()` s'injectent comme avant.
- Typage : passer une `Entity` au champ `sword` compile ; passer un non-`Entity` échoue (test de type / `tsc --noEmit`).
