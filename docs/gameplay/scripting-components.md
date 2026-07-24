# API composants de script (`@atlasjs/gameplay`) — modèle token `defineScriptComponent`

> **Statut : implémenté.** État final de la saga d'unification de l'accès composant côté script. Ce document décrit le **modèle token** (`defineScriptComponent`), qui **supersède** successivement le modèle façade-classe (`ScriptComponent<TEngine>` + getters magiques) puis le nommage/alias de Phase A. Suite directe de `docs/gameplay/gameplay-redesign.md` (phases 0→6 : source unique + autorité par type de corps). Ce document raffine **uniquement la couche d'accès aux composants côté script** ; le pont physique, l'autorité déclarée et la source unique restent inchangés.
>
> L'historique des étapes superséded (magic getters → façade-classe → aliases Phase A → token) est résumé en appendice (§13).

---

## 1. Statut & lignée

La couche d'accès composant a traversé trois états successifs, tous décrits historiquement dans cette saga :

1. **Façade-classe (superséded).** Modèle Unity `GetComponent` : une classe façade `ScriptComponent<TEngine>` déclarant `static engine`, dispatch runtime par `prototype instanceof ScriptComponent`.
2. **Aliases Phase A (superséded).** Élagage des façades passthrough injustifiées, `Transform2DComponent` renommée `Transform`, `RigidBody`/`SpriteRenderer` en simples alias d'export.
3. **Token (état final, ci-dessous).** Un primitif unique `defineScriptComponent(engine, create?)` mint **tous** les composants de script ; le dispatch collapse en un seul point de bifurcation (le brand du token).

Ce document décrit l'état **3** comme la référence courante. Les mécaniques des états 1 et 2 (`ScriptComponent<TEngine>`, `ScriptComponentCtor`, dispatch `instanceof`, alias d'export) ne survivent que dans l'appendice historique.

## 2. Contexte & objectifs — le modèle Unity `GetComponent`

`gameplay-redesign.md` a supprimé l'ECS fantôme et introduit des **façades fines** : des proxys `(world, entity)` sur une source unique dans Nexus, avec routage d'autorité dans les setters. L'accès initial à ces façades avait deux défauts :

1. **Getters magiques imposés.** `AtlasScript` exposait `get transform()` / `get rigidbody()` et construisait d'office les deux façades pour *toute* entité scriptée, même une entité sans rigidbody.
2. **Crash différé, incohérence.** `this.transform` avait toujours l'air présent mais throw à l'accès si le composant moteur n'avait pas été ajouté ; et l'accès aux façades suivait un chemin différent de `this.getComponent(X)`.

L'objectif directeur, tenu jusqu'à l'état final : **unifier tout l'accès composant sur le modèle Unity** — l'utilisateur récupère explicitement ce dont il a besoin et le stocke lui-même.

```ts
this.transform = this.addComponent(Transform);
this.rigidbody = this.addComponent(RigidBody);
```

L'utilisateur écrit `addComponent(X, …)` de façon homogène, **sans suffixe `*Component`**, sans distinction visible façade/raw. Les scripts restent des classes TS lisibles, débuggables et runnables **sans** compilateur — ce qu'on écrit aujourd'hui est l'output qu'aurait produit le futur compilateur (B2).

## 3. Le principe : façade ⇔ vrai comportement moteur

Deux niveaux de composants, et un seul critère pour la frontière entre eux :

- **NIVEAU 1 — composant moteur** (`components/`, sans suffixe). Donnée pure Nexus, opérée par les systèmes (`Transform2D`, `RigidBody2D`, `SpriteRender`, `PhysicsBodyRef`, `PlayerInput`). Le « C++ ».
- **NIVEAU 2 — composant scripting** (`scripting/components/`). Une API curée + autorité par-dessus un composant moteur. Le « C# ».

Les composants de données utilisateur ne sont **pas** un troisième niveau : ce sont des composants Nexus normaux, accédés en raw. Pas de troisième concept.

**Règle de principe : une façade (comportement) existe uniquement quand il y a du vrai comportement moteur à cacher.** Sinon le composant reste NIVEAU 1 et le script l'utilise brut. La douleur qui a motivé le nettoyage n'était pas « il existe des façades » — c'était que la frontière était **incohérente** : le code violait la règle sur 2 façades passthrough sur 3.

| Façade historique | Contenu réel | Verdict |
| --- | --- | --- |
| `Transform2DComponent` | routage d'autorité (`setPosition`→body dynamic), hiérarchie, world-matrix | **comportement réel → justifiée** |
| `RigidBody2DComponent` | 100 % `this.resolve().x` (passthrough) | **curation pure → injustifiée, supprimée** |
| `SpriteRendererComponent` | 100 % `this.resolve().x` + sucre fluent | **curation pure → injustifiée, supprimée** |

Après nettoyage il reste **exactement une** façade comportementale — `Transform`. La frontière doit être **principielle** (façade ⇔ comportement réel), pas arbitraire : `SpriteRender` avait une façade mais `Animator` non, sans raison de principe.

## 4. La primitive token — `scripting/core/ScriptComponentToken.ts`

Le primitif `defineScriptComponent(engine, create?)` mint tous les composants de script sous une forme unique, et sert de **forme d'émission unique** au futur compilateur (B2).

```ts
import { Component, Entity, NexusWorld } from "@atlasjs/nexus";

const BRAND: unique symbol = Symbol("ScriptComponentToken");

export interface ScriptComponentToken<TApi, TEngine extends object, TArgs extends unknown[]> {
  readonly [BRAND]: true;
  readonly engine: Component<TEngine, TArgs>;
  create(world: NexusWorld, entity: Entity): TApi;
}

export function defineScriptComponent<TEngine extends object, TArgs extends unknown[]>(
  engine: Component<TEngine, TArgs>,
): Component<TEngine, TArgs>;
export function defineScriptComponent<TApi, TEngine extends object, TArgs extends unknown[]>(
  engine: Component<TEngine, TArgs>,
  create: (world: NexusWorld, entity: Entity) => TApi,
): ScriptComponentToken<TApi, TEngine, TArgs>;
export function defineScriptComponent<TApi, TEngine extends object, TArgs extends unknown[]>(
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

Deux formes, une seule primitive :

- **Passthrough = identité.** `defineScriptComponent(engine)` sans `create` renvoie `engine` **tel quel** (même référence). Aucun wrapper → les génériques de `PlayerInput<T>` sont préservés gratuitement (le point qui avait tué la façade `PlayerInput` : un ctor `(world, entity)` sévère le paramètre générique). Un composant brut **est** son propre token passthrough.
- **Proxy comportemental.** `defineScriptComponent(engine, create)` renvoie un token brandé `{ [BRAND], engine, create }`. `create` mint un **proxy apatride frais** exposant l'API curée + l'autorité.
- `isScriptComponentToken` : un `Component` est une **fonction** → jamais confondu avec un token (objet brandé). Le brand est aussi une garde contre un objet quelconque portant `engine` : c'est le brand, pas la présence d'`engine`, qui décide du dispatch.

## 5. `Transform`, le seul token comportemental — `scripting/components/Transform.ts`

`Transform` est justifié par trois comportements moteur réels : routage d'autorité, hiérarchie et world-matrix. L'API authored (getters, setters, méthodes chaînables) est portée 1:1 dans l'objet renvoyé par `create` — **inchangée pour l'auteur**. Les helpers privés (`worldMatrix`, `controllingBody`) et la logique parent/enfants sont des **fonctions libres de module** `(world, entity, …)`.

```ts
export interface Transform {
  readonly parent: Transform | null;
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

export const Transform = defineScriptComponent(Transform2D, createTransform);
```

`export const Transform` (valeur = token) **et** `export interface Transform` (type = l'API) partagent le nom : `private transform: Transform` (annotation) **et** `this.addComponent(Transform)` (valeur) fonctionnent tous deux.

**Routage d'autorité (téléport dynamic).** Le setter re-résout la donnée puis, si le corps est dynamic, téléporte le corps physique — jamais une simple écriture ECS :

```ts
setPosition(x: number, y: number): Transform {
  world.requireComponent(entity, Transform2D).position.set(x, y);

  const body: PhysicsBodyRef | undefined = controllingBody(world, entity);
  if (body !== undefined) {
    body.body.setTranslation(x, y);
  }

  return this;
}
```

`controllingBody(world, entity)` renvoie le `PhysicsBodyRef` uniquement si un `RigidBody2D` de type `"dynamic"` existe. `worldMatrix(world, entity)` lit `WorldTransform2D` (ou dérive de `Transform2D`) pour `worldPosition` et pour la conservation de la position monde dans `setParent`.

**Threading de l'`entity` entre proxies — le symbole `ENTITY`.** Choix de conception load-bearing hérité du plan d'implémentation : le proxy n'est **plus une classe** portant `this.entity`, mais un objet littéral. Or `setParent(parent)` a besoin de lire l'`entity` du **parent** (un autre proxy `Transform`) pour appeler `world.setParent(entity, parentEntity)`. La solution : chaque proxy porte son `entity` sous une **clé symbole** privée au module :

```ts
const ENTITY: unique symbol = Symbol("Transform.entity");

type TransformHandle = Transform & { readonly [ENTITY]: Entity };

function entityOf(transform: Transform): Entity {
  return (transform as TransformHandle)[ENTITY];
}
```

`createTransform` pose `[ENTITY]: entity` sur l'objet renvoyé ; `setParent` lit l'entity du parent via `entityOf(parent)`. Le champ `parent` et `getChildren()` re-mintent via `createTransform(world, childEntity)` — ce qui remplace l'ancien `new Transform(world, entity)` de la classe. Le symbole est invisible à l'auteur (il ne fait pas partie de l'interface `Transform`).

## 6. Composants passthrough

Tout le reste est **data-pure** — accédé brut, via l'identité case.

| Nom de script | Backing moteur | Retour de `addComponent` | Forme |
| --- | --- | --- | --- |
| `Transform` | `Transform2D` | proxy `Transform` (API curée) | token comportemental |
| `RigidBody` | `RigidBody2D` | `RigidBody2D` brut | token identité |
| `SpriteRenderer` | `SpriteRender` | `SpriteRender` brut | token identité |
| `Animator` | `Animator` | `Animator` brut | export brut (déjà propre) |
| `PlayerInput` | `PlayerInput` | `PlayerInput<T>` brut (génériques préservés) | export brut (déjà propre) |

`RigidBody` / `SpriteRenderer` passent par l'identité case, avec un `type` alias qui restaure l'annotation :

```ts
import { RigidBody2D, SpriteRender } from "../../components";
import { defineScriptComponent } from "../core";

export const RigidBody = defineScriptComponent(RigidBody2D);
export type RigidBody = RigidBody2D;

export const SpriteRenderer = defineScriptComponent(SpriteRender);
export type SpriteRenderer = SpriteRender;

export * from "./Transform";
```

`defineScriptComponent(RigidBody2D)` renvoie `RigidBody2D` (identité, même réf runtime) ; le `type RigidBody = RigidBody2D` restaure l'annotation. `addComponent(RigidBody)` renvoie donc l'instance moteur brute, pas un proxy.

`Animator` / `PlayerInput` : leur nom de script **==** leur nom moteur. Les router via `defineScriptComponent` sous le même nom collisionnerait au barrel racine `@atlasjs/gameplay` (déjà exportés depuis `components/`) et serait un no-op (identité). Ils **restent des exports bruts** — cohérent avec « un composant brut est son propre token passthrough ». Asymétrie purement au site de définition, **invisible à l'auteur** (qui écrit `addComponent(PlayerInput)` de façon identique). `PlayerInput<T>` conserve ses génériques précisément parce qu'aucun ctor `(world, entity)` ne les efface.

On garde `Transform2D`/`RigidBody2D`/… importables : le boundary est une **convention typée**, pas une barrière runtime. Écrire le raw d'un dynamic sans routage d'autorité est un escape-hatch assumé (bloquer exigerait une table inverse moteur→façade qu'on refuse de maintenir).

## 7. Dispatch runtime — `scripting/runtime/RuntimeScriptContext.ts`

Le dispatch collapse en un **seul point de bifurcation** : « le type est-il un token comportemental ? » (brand). Plus d'`instanceof`/`isFacade` dupliqué.

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

Sémantique du trio (identique quel que soit le niveau) :

| Méthode | Sémantique | Retour | Si absent |
|---|---|---|---|
| `getComponent(X)` | récupère si présent | `X \| undefined` | `undefined` |
| `addComponent(X, ...args)` | get-or-create | `X` | crée puis renvoie |
| `requireComponent(X)` | doit exister | `X` | **throw** |
| `hasComponent(X)` | présence | `boolean` | — |
| `removeComponent(X)` | retire | `void` | no-op |

Pour un token, `addComponent` forwarde les `...args` au **composant moteur** (`type.engine`), puis mint un proxy frais. Seul `Transform` emprunte la branche token aujourd'hui ; `RigidBody`/`SpriteRenderer`/`Animator`/`PlayerInput` sont des `Component` (valeurs `function`) → `isScriptComponentToken` est faux → branche raw.

⚠️ Piège documenté (comportement Nexus, conservé) : `addComponent(token, ...args)` **ignore les args si le composant moteur existe déjà** (get-or-create).

## 8. Typage — `AtlasScript` + `ScriptContext`

Les signatures acceptent l'union `Component | ScriptComponentToken` (le type `ScriptComponentCtor` de l'ère façade-classe est supprimé) :

- `addComponent` : overload `token → TApi` (en premier, plus spécifique) + overload `Component → TEngine`. Un token est un **objet**, un `Component` une **fonction** → pas de chevauchement, résolution d'overload nette.
- `getComponent` : overload `token → TApi | undefined` + `Component → TComponent | undefined`. Idem `requireComponent` (`token → TApi`).
- `hasComponent` / `removeComponent` : type de paramètre élargi à l'union (retour `boolean`/`void`, pas d'overload de retour).
- `requireComponent` (dans `AtlasScript`) : le message d'erreur prend `type.engine.name` pour un token (helper local `typeName(type)`).

**Invariant `any[]` (load-bearing).** Les `any[]` des signatures de composant sont *load-bearing* : le dispatch repose sur l'assignabilité `Component<T, any[]>`. Les resserrer en `unknown[]` (tentant sous la règle « always type ») **casse** la résolution. Ne pas « durcir » ce type.

Côté utilisateur — chacun déclare ses champs (modèle Unity) :

```ts
export class TestScript extends AtlasScript {
  private transform!: Transform;
  private rigidbody!: RigidBody;

  public onCreate(): void {
    this.transform = this.addComponent(Transform);
    this.rigidbody = this.addComponent(RigidBody);
    this.rigidbody.type = "kinematic";
    this.transform.setScale(3, 3).setPosition(400, 300);
  }

  public onUpdate(dt: number): void {
    this.transform.rotate(1 * dt);
  }
}
```

## 9. Layout de package — `packages/gameplay/src`

```
src/
  components/                     # NIVEAU 1 — composants moteur (donnée pure Nexus)
    Transform2D.ts  RigidBody2D.ts  SpriteRender.ts  PhysicsBodyRef.ts  index.ts
  systems/                        # systèmes ECS
    PhysicsPushSystem.ts  PhysicsPullSystem.ts  SpriteRenderSystem.ts  index.ts
  scripting/
    core/                         # FRAMEWORK de script (abstrait)
      AtlasScript.ts  ScriptContext.ts  ScriptLifeCycle.ts
      ScriptComponentToken.ts     # defineScriptComponent / isScriptComponentToken
      index.ts
    components/                   # NIVEAU 2 — tokens scripting
      Transform.ts                # seul token comportemental
      index.ts                    # RigidBody / SpriteRenderer (identité) + Transform
    runtime/                      # ORCHESTRATION
      ScriptManager.ts  RuntimeScriptContext.ts  IncrementalScriptIdGenerator.ts  index.ts
    index.ts
  GameplayPlugin.ts  registerSystem.ts  tokens.ts  index.ts
```

- `scripting/core/` porte le contrat du framework : `ScriptComponentToken` (`defineScriptComponent`/`isScriptComponentToken`).
- `scripting/components/` miroir de `components/` moteur (niveau 1 vs niveau 2).
- `scripting/runtime/` ne garde que l'orchestration.

## 10. Invariants à ne pas régresser

- **Les proxies sont apatrides.** Un proxy ne détient **aucun** état par-instance : chaque accès re-résout via `world.requireComponent(entity, engine)`. Ré-introduire un champ d'instance (ex. un cache) recréerait silencieusement le bug de péremption que cette saga a supprimé.
- **Dispatch par le brand, pas par la présence d'`engine`.** `isScriptComponentToken` teste le brand symbole — un objet quelconque portant `engine` reste raw. Ne pas re-tester une forme structurelle.
- **Re-résolution + throw bruyant.** Un proxy détenu dont le composant moteur a été retiré **throw à l'accès** (`requireComponent`). C'est le contrat Unity (utiliser un composant détruit lève).
- **`any[]` load-bearing** (cf. §8) — ne pas resserrer en `unknown[]`.

## 11. Asymétrie de staleness (raw vs proxy)

Garder une réf brute (`this.rigidbody`, `this.spriteRenderer`) vs un proxy (`this.transform`) a une **sémantique de péremption opposée** :

- **Réf brute** : instance vivante qui **périme silencieusement** si le composant est retiré/re-ajouté (le champ pointe toujours l'ancien objet).
- **Proxy** : re-résout à chaque accès et **throw bruyamment** si le composant moteur manque.

Invisible au pattern commun (`addComponent` une fois en `onCreate`, jamais retiré), mais réel sous churn de composants. Documenté et assumé, pas résolu.

## 12. Roadmap / items ouverts

- **B2 — le compilateur custom.** Sur la surface token, un compilateur TS réécrit `addComponent<T>(...args)` → `addComponent(T, ...args)` (injection du token runtime, syntaxe façon C# `GetComponent<T>()`), génère les métadonnées d'exposition, et **inline** la résolution token + factory → appels bruts directs (zéro dispatch runtime). Le token B1 fournit sa forme d'émission unique.
- **B3 — `Transform` = donnée pure via Nexus `Changed<T>`.** Tuer la dernière façade : `Transform2D` devient donnée pure, l'autorité reste par type de corps mais sans écriture-temps-réel dans un setter. **Dépend** d'un primitif ECS `Changed<T>` absent aujourd'hui (backlog ECS, style Bevy — dirty-tick, pas snapshot de valeur). Le « dragon » : téléporter un dynamic **doit** passer par un canal explicite (reco : `rigidBody.teleport(x, y)` → `body.setTranslation`), car `Changed<T>` ne peut pas distinguer « le script a téléporté » de « le pull a écrit ». Ne pas démarrer B3 avant B2/le primitif.
- **Ré-ergonomies fluent optionnelles** (`SpriteRenderer.setColor()`, `RigidBody.setMass()`) : hors périmètre. Réintroductibles trivialement comme tokens comportementaux si un besoin concret apparaît — sans recréer de classe façade.

## 13. Appendice — historique (superseded)

Les états ci-dessous ne sont plus le modèle courant ; conservés pour comprendre la lignée.

**A. Magic getters + registry (superséded).** `AtlasScript` exposait `get transform()`/`get rigidbody()` ; un `ScriptComponentRegistry` + `EntityScriptComponents` construisaient d'office les façades pour toute entité scriptée, avec un cache invalidable (`invalidate()`). Bug structurel : cache périmé sur `setComponent`, crash différé si le composant n'avait pas été ajouté. Supprimé au profit du modèle Unity explicite.

**B. Façade-classe `ScriptComponent<TEngine>` (superséded).** Une classe de base centralisait le contrat façade↔moteur (`(world, entity)` + `resolve()`), chaque façade déclarant son backing via `static engine`, typé par `ScriptComponentCtor`. Le dispatch runtime testait `type.prototype instanceof ScriptComponent` (choisi sur `"engine" in type` pour éviter qu'un composant de données portant un `static engine` par hasard soit mal classé), avec garde bruyante à la construction si `static engine` manquait. Proxies déjà apatrides (re-résolution via `requireComponent`, cache supprimé). Limite TS assumée : `abstract static engine` n'existe pas → `static engine` restait une convention par sous-classe. Remplacé par le token : la classe et `ScriptComponentCtor` disparaissent, le dispatch `instanceof` devient un test de brand, la garde « `static engine` oublié » disparaît (plus de classe à sous-classer).

**C. Aliases Phase A (superséded).** Étape intermédiaire, sans machinerie token : les deux façades passthrough injustifiées (`RigidBody2DComponent`, `SpriteRendererComponent`) supprimées, `Transform2DComponent` renommée `Transform` (seule façade-classe restante), `RigidBody`/`SpriteRenderer` fournis comme **alias d'export** des composants moteur (`export { RigidBody2D as RigidBody }`). Le boundary script↔moteur devenait un boundary de **nommage**. Remplacé par le token, qui formalise ce boundary en un primitif unique et collapse le dispatch.
