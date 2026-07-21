# B1 — Couche token `defineScriptComponent` (`@atlasjs/gameplay`)

> **Statut : spec validée, à implémenter.** Concrétise l'item **B1** du [backlog](../backlog.md) et la §5.1 de [`scripting-component-unification.md`](scripting-component-unification.md).
> Prérequis de lecture : `scripting-component-unification.md` (Phase A + roadmap Phase B), `scripting-components.md` (modèle `GetComponent`, dispatch), `packages/gameplay/CLAUDE.md` (§ two component levels).

---

## 1. But

Remplacer le nommage/alias de Phase A par un modèle **token unique** qui rend le vocabulaire des composants de script 100 % uniforme et **collapse le dispatch** en un seul chemin.

Aujourd'hui (Phase A) deux formes coexistent au boundary script↔moteur :

- **`Transform`** est une classe façade (`ScriptComponent<Transform2D>` avec `static engine`), matérialisée par `new Transform(world, entity)` ;
- **`RigidBody`/`SpriteRenderer`** sont des alias d'export (`export { RigidBody2D as RigidBody }`), **`Animator`/`PlayerInput`** des composants bruts.

Le dispatch runtime bifurque partout sur `type.prototype instanceof ScriptComponent` (`isFacade`), dupliqué dans `hasComponent`/`getComponent`/`addComponent`/`removeComponent`.

Après B1 :

- un seul primitif, `defineScriptComponent(engine, create?)`, mint **tous** les composants de script ;
- un seul point de bifurcation runtime : « le type est-il un token comportemental ? » (brand), plus d'`instanceof`/`isFacade` ;
- `Transform` est un token comportemental (la classe disparaît) ; le reste est passthrough (identité) ;
- c'est la **forme d'émission unique** que visera le compilateur custom (B2).

## 2. Décisions (validées avec l'auteur)

1. **`ops` = factory renvoyant un objet API** (`create: (world, entity) => TApi`), pas une map de fonctions libres. Préserve l'API `Transform` actuelle à l'identique (getters, setters, chaînage `this`), churn sandbox ~nul. Le surcoût « inlinabilité » est un problème **futur de B2**, qui supprime le token de toute façon ; au runtime B1 les deux formes sont équivalentes.
2. **Passthrough = identité.** `defineScriptComponent(engine)` sans `create` renvoie `engine` **tel quel** (même référence). Aucun wrapper → génériques de `PlayerInput<T>` préservés gratuitement (le point qui avait tué la façade `PlayerInput`). Un composant brut **est** son propre token passthrough.
3. **Ré-ergonomies fluent optionnelles (`SpriteRenderer.setColor()`, `RigidBody.setMass()`) : hors périmètre B1.** `RigidBody`/`SpriteRenderer` restent passthrough brut (`sr.color.set(...)`, `rb.mass = 1`). Réintroduisibles trivialement plus tard comme tokens comportementaux si un besoin concret apparaît.
4. **Proxy apatride, inchangé.** Le proxy minté par `create` ne détient aucune donnée : chaque accès re-résout via `world.requireComponent(entity, engine)`. Invariant « façades stateless » du redesign conservé. L'asymétrie de péremption raw vs proxy (déjà documentée) est inchangée.

## 3. Le primitif — `scripting/core/ScriptComponentToken.ts` (nouveau)

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

- **Sans `create`** : identité (`return engine`). Le token passthrough **est** le `Component` moteur.
- **Avec `create`** : token brandé `{ [BRAND], engine, create }`. `create` mint un proxy apatride frais.
- `isScriptComponentToken` : un `Component` est une **fonction** → jamais confondu avec un token (objet brandé). Le brand est aussi une garde contre un objet quelconque portant `engine`.

## 4. `Transform` : classe → token — `scripting/components/Transform.ts`

La classe `ScriptComponent<Transform2D>` disparaît. Les helpers privés (`worldMatrix`, `controllingBody`) et la logique parent/enfants deviennent des **fonctions libres de module** `(world, entity, …)`. L'API authored (getters, setters, méthodes chaînables) est **portée 1:1** dans l'objet renvoyé par `create`, donc **inchangée pour l'auteur**.

Structure cible :

```ts
export interface Transform {
  parent: Transform | null;
  position: Vec2;
  rotation: number;
  scale: Vec2;
  readonly worldPosition: Vec2;
  setPosition(x: number, y: number): this;
  setRotation(rotation: number): this;
  setScale(x: number, y: number): this;
  translate(dx: number, dy: number): this;
  rotate(angle: number): this;
  setParent(parent: Transform | null, worldPositionStays?: boolean): this;
  getChildren(): Transform[];
}

export const Transform = defineScriptComponent(
  Transform2D,
  (world: NexusWorld, entity: Entity): Transform => ({
    get parent(): Transform | null { /* getParent → Transform.create(world, parentEntity) | null */ },
    get position(): Vec2 { return world.requireComponent(entity, Transform2D).position; },
    set position(v: Vec2) { this.setPosition(v.x, v.y); },
    get worldPosition(): Vec2 { return worldMatrix(world, entity).getTranslation(); },
    // rotation / scale : mêmes get/set qu'aujourd'hui
    setPosition(x: number, y: number): Transform {
      world.requireComponent(entity, Transform2D).position.set(x, y);
      const body: PhysicsBodyRef | undefined = controllingBody(world, entity);
      if (body !== undefined) body.body.setTranslation(x, y);
      return this;
    },
    // setRotation / setScale / translate / rotate / setParent / getChildren : portés depuis la classe
  }),
);
```

- Le champ `parent` et `getChildren()` re-mintent via `Transform.create(world, childEntity)` (le token expose `create`) — remplace `new Transform(world, entity)`.
- `worldMatrix(world, entity)` / `controllingBody(world, entity)` : fonctions libres privées au module (non exportées).
- `export const Transform` (valeur = token) **et** `export interface Transform` (type = l'API) partagent le nom : `private transform: Transform` (annotation) **et** `this.addComponent(Transform)` (valeur) fonctionnent tous deux. Zéro changement dans la sandbox.

## 5. Passthrough — `scripting/components/index.ts`

```ts
import { RigidBody2D, SpriteRender } from "../../components";
import { defineScriptComponent } from "../core";

export const RigidBody = defineScriptComponent(RigidBody2D);
export type RigidBody = RigidBody2D;
export const SpriteRenderer = defineScriptComponent(SpriteRender);
export type SpriteRenderer = SpriteRender;

export * from "./Transform";
```

- `defineScriptComponent(RigidBody2D)` renvoie `RigidBody2D` (identité) → `RigidBody` est un alias runtime (même réf). Le `type RigidBody = RigidBody2D` restaure l'annotation que l'export-alias de Phase A fournissait implicitement.
- **`Animator` / `PlayerInput`** : leur nom de script **==** leur nom moteur. Les router via `defineScriptComponent` sous le même nom collisionnerait au barrel racine `@atlasjs/gameplay` (déjà exportés depuis `components/`) et serait un no-op (identité). Ils **restent des exports bruts** — cohérent avec la décision 2 (un composant brut est son propre token passthrough). Asymétrie purement au site de définition, **invisible à l'auteur** (qui écrit `addComponent(PlayerInput)` de façon identique).

## 6. Collapse du dispatch — `scripting/runtime/RuntimeScriptContext.ts`

`isFacade` (`type.prototype instanceof ScriptComponent`) est supprimé et remplacé par `isScriptComponentToken`. Un seul point de bifurcation, uniforme :

```ts
public hasComponent(type) {
  return this.world.hasComponent(
    this.entity,
    isScriptComponentToken(type) ? type.engine : type,
  );
}

public getComponent(type) {
  if (isScriptComponentToken(type)) {
    if (!this.world.hasComponent(this.entity, type.engine)) return undefined;
    return type.create(this.world, this.entity);
  }
  return this.world.getComponent(this.entity, type);
}

public addComponent(type, ...args) {
  if (isScriptComponentToken(type)) {
    if (!this.world.hasComponent(this.entity, type.engine)) {
      this.world.addComponent(this.entity, type.engine, ...args);
    }
    return type.create(this.world, this.entity);
  }
  const existing = this.world.getComponent(this.entity, type);
  return existing ?? this.world.addComponent(this.entity, type, ...args);
}

public removeComponent(type) {
  this.world.removeComponent(
    this.entity,
    isScriptComponentToken(type) ? type.engine : type,
  );
}
```

Sémantique **identique** à Phase A : la branche token remplace la branche façade trait pour trait (add engine si absent + get-or-create, puis mint un proxy frais). Le `get-or-create` de la branche brute (ignore les args si le composant existe déjà) est inchangé (risque déjà accepté au backlog).

## 7. Typage — `AtlasScript` + `ScriptContext`

`ScriptComponentCtor` est supprimé. Les signatures acceptent l'union `Component | ScriptComponentToken` :

- `addComponent` : overload `token → TApi` (en premier, plus spécifique) + overload `Component → TEngine`. Un token est un objet, un `Component` une fonction → pas de chevauchement, résolution d'overload nette.
- `getComponent` : **ajouter** un overload `token → TApi | undefined` (aujourd'hui signature unique `Component → TComponent | undefined` ; insuffisant pour un token). Idem `requireComponent` (`token → TApi`).
- `hasComponent` / `removeComponent` : élargir le type du paramètre à l'union (retour `boolean`/`void`, pas d'overload de retour nécessaire).
- `requireComponent` (dans `AtlasScript`) : le message d'erreur utilise `type.name` — pour un token, prendre `type.engine.name`. Helper local `typeName(type)`.

`ScriptContext` (interface) reflète les mêmes overloads que `AtlasScript`/`RuntimeScriptContext`.

## 8. Suppressions

- `scripting/core/ScriptComponent.ts` (classe abstraite `ScriptComponent<TEngine>` + `ScriptComponentCtor`).
- Son réexport dans `scripting/core/index.ts` → remplacer par `export * from "./ScriptComponentToken"`.
- Les imports `ScriptComponent` / `ScriptComponentCtor` dans `AtlasScript.ts`, `ScriptContext.ts`, `RuntimeScriptContext.ts`.

## 9. Migration des tests

| Fichier | Changement |
| --- | --- |
| `test/script-components.test.ts` | `new Transform(h.world, e)` → `Transform.create(h.world, e)` (1:1, API du proxy identique). |
| `test/transform-parent-facade.test.ts` | idem `new Transform(world, e)` → `Transform.create(world, e)`. |
| `test/script-context-dispatch.test.ts` | `expect(probe.transform).toBeInstanceOf(Transform)` impossible (token ≠ classe) → check structurel : `typeof probe.transform.setPosition === "function"` + read-back de `Transform2D` (déjà asserté). Les annotations `: Transform` restent valides (type homonyme). |
| `test/script-component-contract.test.ts` | **Obsolète en partie** : `BrokenFacade extends ScriptComponent` + « throw si `static engine` oublié » — ce mode d'échec **disparaît** (plus de classe à sous-classer). Retirer ce cas. **Conserver et renforcer** le cas « `Decoy` avec `static engine` pas mal-classé » : reformuler « un objet non brandé (même avec `static engine`) reste raw » — vérifie que le brand, pas la présence d'`engine`, décide du dispatch. |
| `test/script-integration.test.ts`, `test/determinism.test.ts` | Annotations `: Transform` (type only) → **inchangées**. |

## 10. Docs

- `packages/gameplay/CLAUDE.md` : réécrire « The two component levels » → **modèle token** : `scripting/components/` ne contient plus de classe façade mais des tokens `defineScriptComponent` ; `Transform` = token comportemental (seul avec `create`), le reste passthrough (identité). Mettre à jour la § « Façade & service dispatch » (dispatch sur le brand du token, plus `instanceof ScriptComponent`) et « Invariants » (plus de `ScriptComponent`/`static engine`). Garder la note péremption raw vs proxy.
- `docs/gameplay/scripting-component-unification.md` : marquer **B1 ✅** en tête de §5.1.
- `docs/backlog.md` : B1 → ✅ (ou retirer de la liste des `📋`), en gardant B2/B3 `📋`.

## 11. Ordre d'implémentation (chaque étape verte : `tsc --noEmit` + `pnpm --filter @atlasjs/gameplay test`)

> Cadence : sous-agents, une tâche à la fois, l'auteur commite chaque étape (cf. mémoire cadence).

1. **Primitif** : créer `scripting/core/ScriptComponentToken.ts` (+ export dans `core/index.ts`). Pas encore consommé → vert trivial.
2. **`Transform` → token** : réécrire `Transform.ts` (interface + `defineScriptComponent(Transform2D, factory)` + helpers libres). Adapter `RuntimeScriptContext` (dispatch brand), `AtlasScript`/`ScriptContext` (overloads token), supprimer `ScriptComponent.ts` + ses imports/exports. Migrer les 4 tests impactés. Vert.
3. **Passthrough uniformes** : `RigidBody`/`SpriteRenderer` via `defineScriptComponent` + `type` alias dans `scripting/components/index.ts`. Vérifier le trio add/get/require sur un composant données pures. Vert.
4. **Sandbox** : aucun changement de code attendu (API `Transform` identique, noms passthrough identiques). Vérifier `tsc --noEmit` sandbox + build gameplay.
5. **Docs & règle** : CLAUDE.md package, unification §5.1, backlog.
6. **Vérif finale** : `tsc --noEmit` gameplay + `pnpm --filter @atlasjs/gameplay test` + `tsc --noEmit` sandbox + build gameplay verts. Validation visuelle preview (dino bouge/tourne au clavier+souris, mur statique, épée qui suit la souris) — parité comportementale avec avant.

## 12. Hors périmètre (→ Phase B suivante / backlog)

- **B2 — compilateur** : réécriture `addComponent<T>` → `addComponent(T, …)`, génération `registerScriptMetadata`, inline token + `ops` → appels bruts. B1 fournit sa forme d'émission unique.
- **B3 — `Transform` = donnée pure via `Changed<T>`** : tuer la dernière façade (dépend du primitif ECS `Changed<T>` + canal de téléport dynamic explicite).
- **Ré-ergonomies fluent** (`setColor`/`setMass`/`setSortingOrder`) : réintroductibles comme tokens comportementaux si besoin concret.

## 13. Risques / points ouverts

- **Perte d'`instanceof` pour `Transform`** : un token n'est pas une classe → `x instanceof Transform` n'existe plus. Aucun usage runtime hors le test de dispatch (migré en check structurel). Assumé.
- **Overload resolution token vs Component** : repose sur « token = objet, Component = fonction ». Robuste tant que `defineScriptComponent` sans `ops` renvoie bien le `Component` brut (fonction) et non un objet wrapper.
- **Péremption raw vs proxy** : inchangée (déjà documentée §1/§7 de l'unification). Le proxy re-résout et throw ; un composant passthrough brut périme silencieusement sous churn.
