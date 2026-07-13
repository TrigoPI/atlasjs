# API composants de script (`@atlasjs/gameplay`) — modèle Unity `GetComponent`

> **Statut : design validé, non implémenté.** Suite directe de `gameplay-redesign.md` (phases 0→6 terminées). Ce document raffine **uniquement la couche d'accès aux composants côté script** (§5 « API de script » de l'ancien doc). Le pont physique, l'autorité déclarée et la source unique restent inchangés.

## Contexte

`gameplay-redesign.md` a supprimé l'ECS fantôme et introduit des **façades fines** (`Transform2DComponent`, `RigidBody2DComponent`) : des proxys `(world, entity)` sur une source unique dans Nexus, avec routage d'autorité dans les setters. Mais l'accès à ces façades a deux défauts :

1. **Getters magiques imposés.** `AtlasScript` expose `get transform()` / `get rigidbody()`, et `ScriptComponentRegistry` **construit d'office** les deux façades pour *toute* entité scriptée (`EntityScriptComponents` news `transform` **et** `rigidbody`), même une entité sans rigidbody.
2. **Crash différé, incohérence.** `this.transform` a toujours l'air présent mais `resolve()` fait `requireComponent` → **throw à l'accès** si `addComponent(Transform2D)` n'a pas été fait avant. Et l'accès aux façades (`this.transform`) suit un chemin différent de l'accès aux autres composants (`this.getComponent(X)`).

L'objectif : **unifier tout l'accès composant sur le modèle Unity** — l'utilisateur récupère explicitement ce dont il a besoin et le stocke lui-même :

```ts
this.transform = this.addComponent(Transform2DComponent);
this.rigidbody = this.getComponent(RigidBody2DComponent);
```

## Décisions validées avec l'auteur

1. **Nommage par le type scripting (fidèle à Unity).** L'utilisateur ne nomme **que** la façade : `getComponent(Transform2DComponent)`. Le composant moteur `Transform2D` est **invisible** au script. Signature uniforme `getComponent<T>(new (...) => T): T` — tu reçois une instance du type que tu passes. Les composants de **données pures** (`Health`, `Inventory`) n'ont pas de façade → `getComponent(Health)` renvoie le raw. C'est le split C++/C# : une classe nommée côté script, la classe moteur cachée.

2. **Backing déclaré par `static engine`, dispatch runtime par `"engine" in type`.** Une façade déclare son composant moteur via un champ statique. **Pas de registre de mapping.** `addComponent`/`getComponent` lisent `type.engine` : présent → façade (opère sur le moteur, renvoie le proxy) ; absent → composant Nexus normal (renvoie le raw).

3. **Args forwardés vers le moteur.** `addComponent(Façade, ...args)` type ses `...args` depuis le **constructeur du composant moteur** backing (pas depuis la façade, qui prend `(world, entity)`). Prépare la vision long terme : un plugin TS custom réécrira `addComponent<T>(...args)` → `addComponent(T, ...args)` (injection du token runtime, `<T>()` façon C# `GetComponent<T>()`). La signature `addComponent(Type, ...args)` d'aujourd'hui est déjà la cible du plugin.

4. **Deux niveaux de composants, façade = le composant scripting.** Niveau 1 = composant moteur (`Transform2D`, donnée pure Nexus, opéré par les systèmes, « C++ »). Niveau 2 = façade scripting (`Transform2DComponent`, proxy + API curée + autorité, « C# »). Les composants de données utilisateur ne sont **pas** un troisième niveau : composants Nexus normaux, accédés en raw. **Pas de troisième concept.**

5. **Backing 1:1.** Une façade est backée par **exactement un** composant moteur (pour add/get/remove + forward d'args), mais peut *lire/écrire d'autres* composants moteur dans ses méthodes (déjà le cas : `Transform2DComponent` lit `RigidBody2D` + `PhysicsBodyRef` pour l'autorité).

6. **Pas de barrière runtime sur le moteur.** On n'interdit **pas** `getComponent(Transform2D)` (le type moteur brut). Le boundary est une convention typée, pas une barrière : `Transform2D` reste importable (les systèmes en ont besoin). Écrire le raw d'un dynamic body sans routage d'autorité est un escape-hatch assumé. Bloquer exigerait la table inverse moteur→façade qu'on refuse de maintenir.

7. **Cache/registre supprimés (`ScriptComponentRegistry`, `EntityScriptComponents`, `invalidate()`).** Avec le pattern Unity, `getComponent` n'est appelé qu'une fois (dans `onCreate`) et l'utilisateur détient l'instance. La façade devient un **pur wrapper apatride** `(world, entity)` qui **re-résout à chaque accès** (`world.requireComponent(engine)`). Élimine la machinerie d'invalidation et son seul vrai bug (cache périmé sur `setComponent`, cf. point ouvert de l'ancien doc). Le doc de refonte notait déjà que re-résoudre à chaque accès est négligeable à l'échelle cible (1k–3k entités).

8. **Échec bruyant.** Une façade détenue dont le composant moteur a été retiré **throw à l'accès** (`requireComponent`). C'est le contrat Unity (utiliser un composant détruit lève). L'utilisateur ne garde pas une façade au-delà du retrait de son composant.

9. **Classe de base `ScriptComponent<TEngine>`.** Centralise le contrat façade↔moteur : stocke `(world, entity)`, expose `resolve()`. Limite TS assumée : `abstract static engine` n'existe pas — le `static engine` reste une convention par sous-classe, capturée au niveau type par `ScriptComponentCtor`, non forçable par la base.

## Modèle retenu

### Contrat façade↔moteur (`scripting/core/ScriptComponent.ts`)

```ts
import { Component, Entity, NexusWorld } from "@atlasjs/nexus";

export interface ScriptComponentCtor<
  TFacade,
  TEngine extends object,
  TArgs extends unknown[],
> {
  new (world: NexusWorld, entity: Entity): TFacade;
  readonly engine: Component<TEngine, TArgs>;
}

export abstract class ScriptComponent<TEngine extends object> {
  protected constructor(
    protected readonly world: NexusWorld,
    protected readonly entity: Entity,
  ) {}

  protected resolve(): TEngine {
    const ctor: ScriptComponentCtor<this, TEngine, unknown[]> = this
      .constructor as ScriptComponentCtor<this, TEngine, unknown[]>;
    return this.world.requireComponent(this.entity, ctor.engine);
  }
}
```

### Façade concrète (`scripting/components/Transform2DComponent.ts`)

```ts
export class Transform2DComponent extends ScriptComponent<Transform2D> {
  public static readonly engine = Transform2D;

  public get position(): Vec2 { return this.resolve().position; }
  public setPosition(x: number, y: number): this {
    this.resolve().position.set(x, y);
    const body: PhysicsBodyRef | undefined = this.controllingBody();
    if (body !== undefined) body.body.setTranslation(x, y);   // autorité: téléport dynamic
    return this;
  }
  // ... reste de l'API curée, inchangée par rapport à aujourd'hui (sans le cache interne)

  private controllingBody(): PhysicsBodyRef | undefined {
    const rb: RigidBody2D | undefined = this.world.getComponent(this.entity, RigidBody2D);
    if (rb === undefined || rb.type !== "dynamic") return undefined;
    return this.world.getComponent(this.entity, PhysicsBodyRef);
  }
}
```

Différence avec aujourd'hui : plus de champ `cached`, plus de `invalidate()`. `resolve()` re-résout à chaque appel.

### Dispatch dans le contexte (`scripting/runtime/RuntimeScriptContext.ts`)

Le trio, avec dispatch `"engine" in type` :

| Méthode | Sémantique | Retour | Si absent |
|---|---|---|---|
| `getComponent(X)` | récupère si présent | `X \| undefined` | `undefined` |
| `addComponent(X, ...args)` | get-or-create | `X` | crée puis renvoie |
| `requireComponent(X)` | doit exister | `X` | **throw** |
| `hasComponent(X)` | présence | `boolean` | — |
| `removeComponent(X)` | retire | `void` | no-op |

```ts
private isFacade(type: unknown): type is ScriptComponentCtor<object, object, unknown[]> {
  return typeof type === "function" && "engine" in type;
}

public getComponent<T extends object>(type: Component<T, any[]> | ScriptComponentCtor<T, object, any[]>): T | undefined {
  if (this.isFacade(type)) {
    if (!this.world.hasComponent(this.entity, type.engine)) return undefined;
    return new type(this.world, this.entity);          // wrapper apatride, à la demande
  }
  return this.world.getComponent(this.entity, type as Component<T, any[]>);
}

public addComponent<T extends object, A extends unknown[]>(type: ..., ...args: A): T {
  if (this.isFacade(type)) {
    if (!this.world.hasComponent(this.entity, type.engine)) {
      this.world.addComponent(this.entity, type.engine, ...args);   // args forwardés au moteur
    }
    return new type(this.world, this.entity) as T;
  }
  const existing = this.world.getComponent(this.entity, type);
  return existing ?? this.world.addComponent(this.entity, type, ...args);
}
```

⚠️ Piège documenté : `addComponent(Façade, ...args)` **ignore les args si le composant moteur existe déjà** (get-or-create). Comportement Nexus actuel, conservé.

### Surface finale de `AtlasScript`

**Supprimé** : `get transform()`, `get rigidbody()` (+ `readonly transform`/`rigidbody` de `ScriptContext`), toute construction eager de façade.

**Conservé** (recâblé pour dispatcher) : `getComponent` / `addComponent` / `requireComponent` / `removeComponent` / `hasComponent`, `entityId`, cycle de vie `onCreate/onUpdate/onFixedUpdate/onDestroy`.

Côté utilisateur — chacun déclare ses champs (modèle Unity) :

```ts
export class TestScript extends AtlasScript {
  private transform!: Transform2DComponent;
  private rigidbody!: RigidBody2DComponent;

  public onCreate(): void {
    this.transform = this.addComponent(Transform2DComponent);
    this.rigidbody = this.addComponent(RigidBody2DComponent);
    this.rigidbody.type = "kinematic";
    this.transform.setScale(3, 3).setPosition(400, 300);
  }

  public onUpdate(dt: number): void {
    this.transform.rotate(1 * dt);
  }
}
```

## Réorganisation `packages/gameplay/src`

Rendre les deux niveaux visibles dans l'arbre et séparer le framework de script de l'orchestration :

```
src/
  components/                     # NIVEAU 1 — composants moteur (donnée pure Nexus)
    Transform2D.ts  RigidBody2D.ts  SpriteRender.ts  PhysicsBodyRef.ts  index.ts
  systems/                        # systèmes ECS (inchangé)
    PhysicsPushSystem.ts  PhysicsPullSystem.ts  SpriteRenderSystem.ts  index.ts
  scripting/
    core/                         # FRAMEWORK de script (abstrait)
      AtlasScript.ts  ScriptContext.ts  ScriptLifeCycle.ts
      ScriptComponent.ts          # base + type ScriptComponentCtor
      index.ts
    components/                   # NIVEAU 2 — façades scripting (concrètes)
      Transform2DComponent.ts  RigidBody2DComponent.ts  index.ts
    runtime/                      # ORCHESTRATION (plus de registre)
      ScriptManager.ts  RuntimeScriptContext.ts  IncrementalScriptIdGenerator.ts  index.ts
    index.ts
  GameplayPlugin.ts  registerSystem.ts  tokens.ts  index.ts
```

Mouvements clés :
- Façades `scripting/runtime/` → `scripting/components/` : **miroir** de `components/` moteur (niveau 1 vs niveau 2).
- `ScriptComponent` + `ScriptComponentCtor` → `scripting/core/` (contrat du framework).
- `scripting/runtime/` ne garde que l'orchestration. `ScriptComponentRegistry` + `EntityScriptComponents` **supprimés**.

## Plan d'implémentation (par phases, chacune verte : tsc + tests)

- **Phase 1 — Base + contrat, façades reshapées & déplacées.** Créer `scripting/core/ScriptComponent.ts` (base + `ScriptComponentCtor`). `Transform2DComponent`/`RigidBody2DComponent` héritent, déclarent `static engine`, **conservent transitoirement** `invalidate()`/cache (le registre existant compile encore). Déplacer vers `scripting/components/`. Mettre à jour imports + tests qui construisent les façades.
- **Phase 2 — Dispatch dans le contexte.** Réécrire `getComponent`/`addComponent`/`requireComponent`/`hasComponent`/`removeComponent` avec `"engine" in type` + sémantique du trio. Les getters magiques restent (délèguent encore au registre). Vert.
- **Phase 3 — Suppression getters magiques + registre + cache façade.** Retirer `get transform()`/`get rigidbody()` (`AtlasScript` + `ScriptContext`), supprimer `ScriptComponentRegistry`/`EntityScriptComponents`, retirer `cached`/`invalidate()` des façades (re-résolution à chaque accès). Simplifier `ScriptManager` (plus d'arg registre ni `release`) + `GameplayPlugin`. Migrer `TestScript` (sandbox) + `MoveScript`/tests dans la même phase (les getters disparaissent). Vert.
- **Phase 4 — Exports + finitions.** `index.ts` (export public des types façade), nettoyage, `tsc` gameplay + sandbox, suite de tests complète.

## Checklist

- [x] Phase 1 — base `ScriptComponent<TEngine>` (cache/`invalidate` conservés transitoirement) + `ScriptComponentCtor` dans `scripting/core/` ; `Transform2DComponent`/`RigidBody2DComponent` héritent, déclarent `static engine`, déplacées vers `scripting/components/` (miroir de `components/` moteur). Constructeur de base `public` (façades `new`-ées par le registre puis, en Phase 3, par le contexte). Registre/contexte/`AtlasScript`/`ScriptContext` repointés sur `../components`. tsc gameplay + build + tsc sandbox OK, 20/20 tests verts.
- [x] Phase 2 — dispatch `"engine" in type` + trio dans `RuntimeScriptContext` (`get`/`add`/`require`/`has`/`remove` : façade → opère sur `type.engine`, renvoie un proxy neuf ; sinon raw). Typage : façade `new (world, entity) => T` déjà assignable à `Component<T, any[]>` → seul `addComponent` a besoin d'overloads (args forwardés depuis le moteur) sur `ScriptContext`/`AtlasScript`/`RuntimeScriptContext`. Getters magiques inchangés (délèguent au registre). 6 tests de dispatch ajoutés (façade add/has/get/remove/require + raw data + forward d'args). 26/26 verts, tsc gameplay + build + tsc sandbox OK.
- [x] Phase 3 — getters magiques (`AtlasScript` + `ScriptContext`) supprimés ; `ScriptComponentRegistry`/`EntityScriptComponents` supprimés ; `cached`/`invalidate()` retirés de `ScriptComponent` (re-résolution pure via `requireComponent`, échec bruyant si absent). `RuntimeScriptContext` réduit à `(entity, world)` ; `ScriptManager(world)` sans registre ni `release` ; `GameplayPlugin` nettoyé. `MoveScript`/`KinematicMover`/`TestScript` migrés sur `this.x = this.addComponent(Façade)` + champs `!`. `script-components.test.ts` réécrit (façades construites directement, sémantique re-résolution + throw-si-absent). 25/25 verts, tsc gameplay + build + tsc sandbox OK.
- [ ] Phase 4 — exports publics + tsc + tests verts.

## Points ouverts / risques

- **`getComponent(façade)` mint un wrapper neuf à chaque appel.** Sans conséquence au pattern visé (appel unique en `onCreate`), mais deux `getComponent` successifs renvoient deux instances distinctes wrappant la même donnée. Acceptable (apatride).
- **`addComponent(Façade, ...args)` ignore les args si le moteur existe déjà** (get-or-create). Documenté ; comportement Nexus.
- **Plugin TS `<T>()` → `(T, ...args)`** : hors scope ici. La signature `addComponent(Type, ...args)` est conçue pour être la cible de la réécriture sans changement ultérieur.
