# Refonte du gameplay & scripting (`@atlasjs/gameplay`)

> **Statut : implémenté (phases 0→6 terminées).** Document de design + suivi. Voir la checklist en bas.

## Context

`@atlasjs/gameplay` assemble l'ECS (`@atlasjs/nexus`), la physique (`@atlasjs/inertia`) et le rendu (`@atlasjs/nebula`) en composants + systèmes de jeu, et expose une couche de **scripting** (style Unity : `onCreate`/`onUpdate`/`onFixedUpdate`/`onDestroy`) pour la logique utilisateur.

L'archi actuelle fonctionne mais est **bancale sur un seul point, structurant : la synchronisation de la donnée entre couches.** Une même position vit aujourd'hui dans **4 représentations** et une machinerie de réconciliation les recopie à chaque frame.

### La donnée dupliquée (le nœud du problème)

Pour maintenir une seule position cohérente, elle est stockée :

1. **Composant script** — `Transform2DComponent` / `RigidBody2DComponent` dans `ScriptComponentStorage` (un `Map<Type, Map<Entity, object>>` **totalement séparé de Nexus**, avec son propre type maths `Vector2D`).
2. **Composant moteur (ECS)** — `Transform2D` / `RigidBody2D` dans le world Nexus (avec `Vec2`).
3. **Runtime physique** — le `RigidBody` d'inertia dans un `SparseSet<RigidBody>` géré à la main.
4. **Snapshot de diff** — `Transform2DSyncState` dans `ScriptComponentRuntimeStorage`, pour détecter « le script a-t-il changé la valeur ? ».

Et **8 systèmes + 1 composant tampon** (`TransformWriteRequest`) n'existent que pour faire circuler la donnée entre ces copies chaque frame :

```
Script(shadow) --diff snapshot--> TransformWriteRequest --> [ body physique | Transform2D ]
                                                                   │ PhysicsStep (inertia)
Transform2D  <--writeback-- RigidBody  <---------------------------┘
Script(shadow) <--feedback-- Transform2D   (+ recapture snapshot)
```

### Pourquoi c'est bancal

La couche script (`ScriptComponentStorage`) est en réalité **un second ECS fantôme** posé par-dessus Nexus : des types qui doublent les vrais (`Transform2DComponent` ↔ `Transform2D`), un type maths qui double l'autre (`Vector2D` ↔ `Vec2`), et une machinerie diff/request/feedback dont l'unique rôle est de recopier l'un dans l'autre. **Toute la douleur de synchro vient de là.**

L'intention derrière ce split était bonne et légitime : reproduire le modèle **Unity C++ ↔ C#**, où l'utilisateur manipule un composant « script » et jamais le composant « moteur » brut. Mais le split Unity n'est **pas une copie** : le `Transform` C# est un **handle fin** (un proxy) dont les getters/setters traversent la frontière d'interop et lisent/écrivent **directement** la mémoire C++. Il y a **une seule source de vérité** (le C++) ; le C# est une *fenêtre* dessus, pas un double. Le split existe là-bas parce qu'une **frontière technique dure** (mémoire managée/GC vs native) *force* le proxy. En TypeScript cette frontière n'existe pas : on a payé le coût de la séparation (la sync) sans la contrainte qui la justifierait.

> Corollaire clarifiant : dans le vrai ECS, `RigidBody2D` **n'a pas** de champ `position` — seul `Transform2D` la porte. Le « `rigidbody.position » qui inquiète n'existe que dans la copie fantôme (`RigidBody2DComponent.position`). Une fois la couche fantôme supprimée, la question « la position est dans 2 composants, lequel gagne ? » **disparaît côté ECS** : il ne reste qu'une source (`Transform2D`) et le miroir inévitable du moteur physique — géré par un pont à autorité déclarée (cf. §4).

### Problèmes identifiés

1. **ECS fantôme = 4 copies d'une même donnée.** Source unique inexistante ; la cohérence repose sur une boucle de recopie manuelle par frame.
2. **~8 systèmes pour un seul concept.** `ScriptTransformRequestSystem`, `RigidBody2DRequestSystem`, `TransformRequestResolveSystem`, `RigidBodyWriteBackSystem`, `ScriptTransformFeedbackSystem`, `TransformWriteRequestCleanupSystem` (+ `RigidBody2DSystem`) n'existent que pour ponter les copies.
3. **Diffing par snapshot fragile.** `Transform2DSyncState` ne détecte que le **delta net entre deux frames** (`x=10` puis `x=0` dans la même frame = « rien changé ») et ne distingue pas « le script a écrit » de « la physique a écrit ».
4. **Allocations dans le hot path.** `new Transform2DSyncState()` + `Array.from(entries())` **par entité et par frame** dans les systèmes de request/feedback — viole le principe perf du repo.
5. **Autorité implicite.** « Qui gagne entre script et physique » est enfoui dans `hasPhysicsControl` + l'ordre des stages, jamais déclaré explicitement.
6. **État runtime hors ECS.** `runtimeBodies: SparseSet<RigidBody>` et `ScriptComponentRuntimeStorage` sont des stockages parallèles clés par entité, à cycle de vie manuel — alors que Nexus offre déjà `onAdd`/`onRemove`.
7. **Deux types de vecteurs** (`Vector2D` côté script vs `Vec2` moteur) qui se recopient champ à champ.

## Décisions validées avec l'auteur

- **On garde l'objectif d'encapsulation** : l'utilisateur manipule une API script curée, pas les composants moteur bruts. C'est un principe sain (stabilité d'API, sûreté, méthodes de confort, application des règles d'autorité).
- **Façade, pas copie.** On implémente ce split comme Unity le fait *réellement* : un **proxy fin** (handle) sur **une source de vérité unique** dans Nexus. Le handle **pointe** vers la donnée, ne la **duplique** jamais.
- **Style façade retenu** (vs style « direct » à la Bevy où les scripts tapent les composants bruts). La façade est réservée aux **composants moteur** (ceux à autorité/encapsulation) ; les composants de données propres à l'utilisateur restent accessibles directement.
- **Résolution à la demande, sans cache.** Le handle re-résout l'instance réelle à **chaque** accès (cf. §3). *(La décision d'origine — mise en cache + invalidation via `world.onRemove` — a été **inversée** depuis : le cache périmait silencieusement. Le modèle courant est le proxy apatride du token `defineScriptComponent`, cf. `docs/gameplay/scripting-components.md`.)*
- **Autorité déclarée par le type de corps** (dynamic/kinematic/static), appliquée au moment de l'écriture par la façade + le pont. Fin de l'ambiguïté « et si je bouge les deux en même temps ».
- **Source de vérité unique par donnée.** Un seul `Transform2D`, un seul `RigidBody2D`. Les handles runtime (body physique) deviennent des composants Nexus.
- **`Vec2` partout.** Suppression de `Vector2D`.

## Résultat visé

Un gameplay où : chaque donnée a **une source unique** dans Nexus ; les scripts la manipulent via une **façade fine** (zéro copie, API curée) ; le pont physique applique **une règle d'autorité déclarée** ; l'état runtime vit **dans l'ECS** (cycle de vie automatique) ; il ne reste **qu'un pont physique à deux systèmes** au lieu de la nuée actuelle.

---

## Modèle retenu

### 1. Composants moteur = donnée pure, source unique

Dans Nexus, inchangés ou quasi :

```ts
class Transform2D {          // SEUL détenteur de la position/rotation/scale côté ECS
  position: Vec2; scale: Vec2; rotation: number;
}
class RigidBody2D {          // PAS de position (déjà le cas aujourd'hui)
  type: RigidBodyType; mass: number;
  velocity: Vec2; angularVelocity: number;
}
class SpriteRender { /* inchangé */ }
```

Nouveau composant **runtime-only** (remplace le `SparseSet<RigidBody>`) :

```ts
class PhysicsBodyRef { constructor(public body: RigidBody) {} }
```

- Le handle inertia devient un composant Nexus normal → les queries le joignent (`query(RigidBody2D, Transform2D, PhysicsBodyRef)`), et `world.onRemove(PhysicsBodyRef, …)` (ou `onRemove(RigidBody2D, …)`) détruit le body — **plus de `SparseSet` ni de hook manuel** dans le plugin.
- Non sérialisable : c'est un composant de runtime, jamais persisté (à marquer comme tel si une sérialisation arrive plus tard, cf. `docs/rendering/material-graph.md` pour le pattern).

### 2. Façade script = handle fin (le cœur)

> **Forme finale :** la façade décrite ici a été mintée depuis en **token** `defineScriptComponent(engine, create?)` — le proxy est **apatride** et re-résout à chaque accès. Le bloc ci-dessous montre la forme réellement implémentée (`packages/gameplay/src/scripting/components/Transform.ts`) ; les détails du modèle token sont dans `docs/gameplay/scripting-components.md`.

Un handle **ne contient aucune donnée** : il enveloppe `(world, entity)` et lit/écrit le vrai composant moteur.

```ts
const ENTITY: unique symbol = Symbol("Transform.entity");

class TransformHandle implements Transform {
  public readonly [ENTITY]: Entity;
  private readonly world: NexusWorld;

  public constructor(world: NexusWorld, entity: Entity) { this.world = world; this[ENTITY] = entity; }

  // aucun cache : chaque accès re-résout la source unique
  public get position(): Vec2 { return this.world.requireComponent(this[ENTITY], Transform2D).position; }
  public get rotation(): number { return this.world.requireComponent(this[ENTITY], Transform2D).rotation; }
  public get scale(): Vec2 { return this.world.requireComponent(this[ENTITY], Transform2D).scale; }

  // API curée conservée
  public translate(dx: number, dy: number): Transform { const p = this.world.requireComponent(this[ENTITY], Transform2D).position; return this.setPosition(p.x + dx, p.y + dy); }
  public setPosition(x: number, y: number): Transform { /* voir §4 : routage d'autorité */ return this; }
  public rotate(angle: number): Transform { return this.setRotation(this.world.requireComponent(this[ENTITY], Transform2D).rotation + angle); }
  public setScale(x: number, y: number): Transform { this.world.requireComponent(this[ENTITY], Transform2D).scale.set(x, y); return this; }
}

export const Transform = defineScriptComponent(Transform2D, createTransform);
```

- **Encapsulation préservée** : le script ne voit que le token `Transform` (et l'interface du même nom), jamais `Transform2D`. L'objectif initial est atteint.
- **Zéro copie / zéro sync / zéro cache** : `this.transform.position.x += 10` mute la source de vérité. Plus de request/feedback/snapshot, et rien à invalider.
- Les composants de **données utilisateur** (ex. `Health`, `Inventory`) n'ont **pas** de façade : ils sont enregistrés comme composants Nexus normaux et `ctx.getComponent(Health)` renvoie l'instance réelle. La façade est réservée aux composants **moteur** (encapsulation + autorité). Ça évite de recréer la cérémonie « un handle par composant » pour le code de l'utilisateur.

### 3. Résolution à chaque accès, sans cache ni registre

> **Décision inversée.** Ce paragraphe décrivait un cache par handle invalidé via `world.onRemove`, tenu par un `ScriptComponentRegistry` construit d'office pour toute entité scriptée. Le cache périmait silencieusement (`world.setComponent` remplace l'instance sans émettre `onRemove`) et le registre imposait des façades non demandées : les deux ont été **supprimés**. Il n'existe ni `ScriptComponentRegistry.ts`, ni `Transform2DComponent.ts`, ni `RigidBody2DComponent.ts` dans le code.

Le handle résout `world.requireComponent(...)` **à chaque accès**, et ne mémorise rien. Aucun registre, aucune souscription de cycle de vie, aucun contrat d'invalidation à respecter.

```ts
public get position(): Vec2 {
  return this.world.requireComponent(this[ENTITY], Transform2D).position;
}
```

**Ce que ça garantit :**

- **Pas de péremption possible.** Un handle détenu par un script après un `removeComponent` ne pointe pas une instance morte : il **throw bruyamment** au prochain accès (`requireComponent`). C'est le contrat Unity — utiliser un composant détruit lève.
- **`setComponent` cesse d'être un piège.** Remplacer l'instance en place n'a plus besoin d'émettre quoi que ce soit : la résolution suivante voit la nouvelle.
- **Cycle de vie nul.** Un proxy est un objet frais minté par `token.create(world, entity)` à chaque `getComponent`/`addComponent` ; rien à relâcher quand le dernier script d'une entité meurt. Corollaire assumé : **pas d'identité stable** entre deux résolutions (pas de `===`, pas de clé de `Map`).
- **Ne pas ré-introduire de champ d'instance de cache** dans un proxy : ce serait exactement le bug supprimé ici.

> Note perf assumée : à l'échelle cible (1k–3k entités, cf. `docs/core/nexus-ecs.md`), re-résoudre `world.requireComponent` à chaque accès est négligeable — c'est ce qui a permis d'abandonner le cache sans le remplacer. Le seul coût restant est l'allocation du proxy par résolution ; le handle est une **classe** (méthodes sur le prototype) plutôt qu'un objet littéral précisément pour que cette allocation reste une seule shape à deux champs.

### 4. Pont physique & autorité déclarée

On **garde la forme** du pipeline (déjà alignée sur les stages du core : `PhysicsRequest → PhysicsStep → PhysicsWriteback`), mais réduite à **deux systèmes** qui remplacent les six actuels. *(Un troisième, `PhysicsCollisionSystem`, s'est ajouté depuis en `PhysicsWriteback` après le pull : il draine les événements du solveur vers `onCollisionEnter`/`onTriggerEnter` — il ne participe pas au transport de la position et ne remet pas en cause la table d'autorité ci-dessous.)*

**Table d'autorité (la règle unique) :**

| Type de corps | Autorité sur la position | Mécanisme par step |
|---|---|---|
| `dynamic` | **physique** | writeback `body → Transform2D` ; `setPosition` script = **téléport explicite** |
| `kinematic` | **script / `Transform2D`** | push `Transform2D → body` (`body.setTranslation`/`setRotation` chaque step) |
| `static` | `Transform2D` | poussé à la création, quasi jamais ensuite |
| *(pas de `RigidBody2D`)* | script (`Transform2D`) | le script écrit `Transform2D` directement, aucun pont |

**`PhysicsPushSystem`** — stage `PhysicsRequest` (avant `PhysicsStep`) :
- `query(RigidBody2D, Transform2D).without(PhysicsBodyRef)` → crée le body inertia depuis `Transform2D`+`RigidBody2D`, ajoute `PhysicsBodyRef`. Remplace la création de `RigidBody2DSystem`. *(Les entités sont collectées dans un tableau réutilisé pendant l'itération, puis mutées **après** la query — pas via `world.commands` comme prévu ici.)*
- `query(RigidBody2D, Transform2D, PhysicsBodyRef)` → pousse dans le body : vélocité/angular depuis `RigidBody2D` ; pour `kinematic`/`static`, pousse aussi la position/rotation depuis `Transform2D` ; sync `mass` ; sync `type` **par synchronisation** — sur divergence uniquement, `body.setBodyType(rigidBody.type)` (primitive `RigidBody.setBodyType` d'inertia). Le body **garde son identité, son handle, ses colliders et son état** (`gravityScale`, damping, `userData`) : il n'y a **aucune destruction/recréation** sur ce chemin.
- Ajout depuis : le même système mint aussi les `PhysicsColliderRef` (depuis `Collider2D`) et les `CharacterControllerRef` (depuis `CharacterController2D`), et re-synchronise les colliders existants sur leur `Collider2D`. Pour une entité parentée, la position poussée vient du `WorldTransform2D` et non du `Transform2D` local.

**`PhysicsPullSystem`** — stage `PhysicsWriteback` (après `PhysicsStep`) :
- `query(RigidBody2D, Transform2D, PhysicsBodyRef)` → `transform.position = body.getTranslation()`, `transform.rotation = body.getRotation()`, `rigidBody.velocity = body.getLinearVelocity()`. Vaut **uniquement pour `dynamic`** (`if (type !== "dynamic") return`) : pour `kinematic`, `Transform2D` reste la source (poussée vers le solveur par `PhysicsPushSystem`), donc le pull n'a rien à en tirer — le lire en retour re-créerait une deuxième autorité sur la même donnée.

**Réponse à « et si je bouge les deux en même temps ? »** — il n'y a plus de « les deux ». Pour une entité donnée, **une seule autorité** détient la position, déterminée par le type de corps :
- corps `dynamic` : on le déplace en écrivant la **vélocité/force** (via `RigidBody`), pas la position ; `setPosition` est un **téléport explicite** qui appelle `body.setTranslation(...)` (échappatoire assumée, jamais un clobber silencieux).
- corps `kinematic` : `Transform2D` est la source ; le push l'applique au solveur chaque step.
La décision est prise **au moment de l'écriture**, dans le setter de la façade, en lisant `RigidBody2D.type`. Aucune course possible : deux écritures « concurrentes » passent par la même règle et le même chemin d'autorité.

### 5. API de script

> **Raffiné depuis :** l'accès aux façades décrit ici (getters magiques `this.transform`/`this.rigidbody`) est remplacé par un accès unifié façon Unity `GetComponent` — voir `docs/gameplay/scripting-components.md`.

`ScriptContext` enveloppe le vrai world. `AtlasScript` expose des accès façon Unity :

```ts
abstract class AtlasScript {
  get transform(): Transform2DComponent;          // handle (jamais Transform2D brut)
  get rigidbody(): RigidBody2DComponent | null;   // null si pas de RigidBody2D
  getComponent<T>(type): T | null;             // composant de DONNÉE utilisateur → instance réelle
  addComponent<T>(type, ...args): T;           // world.addComponent (direct : scripts hors query world)
  removeComponent<T>(type): void;
  // + onCreate / onUpdate(dt) / onFixedUpdate() / onDestroy() inchangés
}
```

- `addComponent`/`removeComponent` restent **directs** : `ScriptManager` itère ses propres records, pas une query world → aucun hazard de mutation-pendant-itération (cf. garde-fou Nexus). Si un jour les scripts sont pilotés dans une query world, basculer sur `world.commands`.
- `ScriptManager` (files pending create/destroy, `onCreate/onUpdate/onFixedUpdate/onDestroy`) est **conservé tel quel** ; seul le `ScriptContext` change (vrai world au lieu du shadow storage). *(L'appel `handleRegistry.release(entity)` prévu ici n'existe plus : sans cache il n'y a rien à relâcher, cf. §3.)*

### 6. Ce qu'on supprime / garde / ajoute

**Supprimer**
- `scripting/components/Transform2DComponent.ts`, `RigidBody2DComponent.ts`
- `scripting/maths/Vector2D.ts` (→ `Vec2`)
- `scripting/runtime/ScriptComponentStorage.ts`, `ScriptComponentRuntimeStorage.ts`, `Transform2DSyncState.ts`
- `components/TransformWriteRequest.ts`
- Systèmes : `ScriptTransformRequestSystem`, `ScriptTransformFeedbackSystem`, `TransformRequestResolveSystem`, `RigidBody2DRequestSystem`, `TransformWriteRequestCleanupSystem`

**Garder**
- `components/Transform2D.ts`, `RigidBody2D.ts`, `SpriteRender.ts`
- `systems/SpriteRenderSystem.ts`
- `scripting/core/ScriptManager` (+ `AtlasScript`, cycle de vie), `registerSystem` (depuis déplacé dans `@atlasjs/nexus`, ré-exporté par le barrel gameplay), `GameplayPlugin` (recâblé)

**Ajouter**
- `components/PhysicsBodyRef.ts`
- `scripting/components/Transform.ts` — le handle, minté par `defineScriptComponent` (`scripting/core/ScriptComponentToken.ts`). *(Prévu ici comme `scripting/runtime/Transform2DComponent.ts` + `RigidBody2DComponent.ts` + `ScriptComponentRegistry.ts` : aucun des trois n'existe — `RigidBody` est un token identité et il n'y a pas de registre, cf. §3.)*
- `systems/PhysicsPushSystem.ts`, `PhysicsPullSystem.ts` (fusion des ex-`RigidBody2DSystem` + `RigidBodyWriteBackSystem`)
- `ScriptContext`/`RuntimeScriptContext` réécrits sur le vrai world

Bilan : **~7 systèmes + 3 storages + 3 types → 2 systèmes + 1 composant + des handles fins.**

---

## Exemple de migration (`apps/dino-brawl`)

Avant (`TestScript`, couche fantôme) :

```ts
public onCreate(): void {
  this.transform = this.addComponent(Transform2DComponent);   // shadow
  this.rigidBody = this.addComponent(RigidBody2DComponent);   // shadow
  this.rigidBody.type = "kinematic";
  this.transform.scale.set(3, 3);
  this.transform.position.set(400, 300);
}
public onUpdate(dt: number): void { this.rigidBody.rotation += 1 * dt; }
```

Après (tokens sur la source unique — l'utilisateur récupère et stocke lui-même, façon Unity) :

```ts
private transform!: Transform;
private rigidbody!: RigidBody;

public onCreate(): void {
  this.rigidbody = this.addComponent(RigidBody);   // token identité → RigidBody2D brut
  this.transform = this.addComponent(Transform);   // token comportemental → proxy apatride
  this.rigidbody.type = "kinematic";
  this.transform.setScale(3, 3);
  this.transform.setPosition(400, 300);     // kinematic → écrit Transform2D (autorité script)
}
public onUpdate(dt: number): void { this.transform.rotate(1 * dt); }
```

L'ergonomie côté utilisateur est quasi identique — mais il n'y a plus de copie, plus de sync, plus de `Vector2D`.

---

## Plan d'implémentation (par phases)

- **Phase 0 — Filet de sécurité.** Tests vitest gameplay qui verrouillent le comportement attendu du pont : dynamic → physique autoritaire (writeback gagne) ; kinematic → transform autoritaire (push gagne) ; téléport explicite d'un dynamic ; création/destruction du body via cycle de vie.
- **Phase 1 — `PhysicsBodyRef` + pont à 2 systèmes.** Introduire le composant, `PhysicsPushSystem`/`PhysicsPullSystem`, brancher `onRemove` pour détruire le body. Remplace `RigidBody2DSystem` + `RigidBodyWriteBackSystem` + le `SparseSet` + le hook manuel. (Encore piloté par les composants moteur, sans toucher au scripting.)
- **Phase 2 — Handles + registre + cache.** `Transform2DComponent`, `RigidBody2DComponent`, `ScriptComponentRegistry` (invalidation via `onRemove`). Routage d'autorité dans les setters.
- **Phase 3 — `ScriptContext` sur le vrai world.** Réécrire `RuntimeScriptContext` ; `AtlasScript.transform`/`.rigidbody` → handles ; `getComponent` → composants réels. Brancher `release(entity)` dans `ScriptManager`.
- **Phase 4 — Suppression de la couche fantôme.** Retirer `ScriptComponentStorage`, `ScriptComponentRuntimeStorage`, `Transform2DComponent`, `RigidBody2DComponent`, `Transform2DSyncState`, `TransformWriteRequest` + les 5 systèmes de pont fantôme. Nettoyer `GameplayPlugin`.
- **Phase 5 — `Vec2` partout.** Supprimer `Vector2D`, migrer les usages.
- **Phase 6 — Migration `apps/dino-brawl`.** `TestScript` (+ autres) sur la nouvelle API.

> **Piste future (hors scope, à documenter séparément si besoin) :** un primitif de **détection de changement par ticks** dans Nexus (façon Bevy `Changed<T>`) remplacerait tout diffing manuel résiduel et servirait à synchroniser *n'importe quelle* paire de composants, pas seulement le cas physique. Non requis par cette refonte (la façade + l'autorité par type de corps suffisent), mais c'est la brique générale si le besoin réapparaît.

## Checklist

- [x] Phase 0 — tests de pont (double `FakePhysicsWorld`, autorité dynamic/kinematic, cycle de vie du body). 4 tests verrouillent le comportement à préserver ; 2 `it.fails` (clobber kinematic) sont des tripwires qui basculeront en `it` en Phase 1.
- [x] Phase 1 — `PhysicsBodyRef` + `PhysicsPushSystem`/`PhysicsPullSystem` + `onRemove` (retire `SparseSet` + hook manuel + `RigidBody2DSystem`/`RigidBodyWriteBackSystem`). `TransformRequestResolveSystem` repointé sur `PhysicsBodyRef` (fantôme intact). Élargissement Nexus : `onAdd`/`onRemove`/`hasComponent`/`removeComponent`/`requireComponent` acceptent désormais des composants à args (`Component<T, any[]>`), permettant à un composant porteur de handle (`PhysicsBodyRef`) de passer par le cycle de vie. Les 2 tripwires kinematic sont verts.
- [x] Phase 2 — handles `Transform2DComponent`/`RigidBody2DComponent` + `ScriptComponentRegistry` (cache + invalidation via `onRemove`) + routage d'autorité dans les setters (dynamic → téléport body ; kinematic/static → `Transform2D`). Construits et testés en isolation (9 tests : source unique, invalidation, autorité, escape-hatch du getter live). Pas encore branchés aux scripts (Phase 3).
- [x] Phase 3 — `ScriptContext`/`RuntimeScriptContext` sur le vrai world ; `AtlasScript.transform`/`.rigidbody` → handles, `getComponent`/`addComponent` → composants réels ; `ScriptManager(world, handleRegistry)` + `release(entity)` au dernier script détruit ; `GameplayPlugin` crée/dispose le registre. `MoveScript` (test détermin.) et `TestScript` (`dino-brawl`) migrés sur la façade. Fantôme laissé en no-op (supprimé Phase 4). Test d'intégration bout-en-bout ajouté (script → handle → pont → physique). 20 tests verts, tsc gameplay + dino-brawl OK.
- [x] Phase 4 — suppression couche fantôme (`ScriptComponentStorage`, `ScriptComponentRuntimeStorage`, `Transform2DSyncState`, `TransformWriteRequest`, les 5 systèmes de pont fantôme, `ScriptComponentConstructor`) + nettoyage `GameplayPlugin` (pont réduit à `physics-push`/`physics-pull`). **Renommage `Handle → Component`** : `Transform2DComponent`/`RigidBody2DComponent` (façades), `ScriptComponentRegistry`, `EntityScriptComponents` — plus aucun vocabulaire « Handle ». Build gameplay : 119 → 78 fichiers. 20 tests verts, `dino-brawl` tsc OK.
- [x] Phase 5 — `Vec2` partout : `Vector2D` supprimé (n'était utilisé que par la couche fantôme ; le reste du code était déjà en `Vec2`). Réalisé en même temps que la Phase 4.
- [x] Phase 6 — migration `apps/dino-brawl` : `TestScript` (seule entité scriptée) migré sur la façade dès la Phase 3.

> **Superséded depuis (phases 2-3).** Les livrables « handles + registre + cache » des phases 2 et 3 ci-dessus ont été **démontés** par la saga suivante : les façades-classes `Transform2DComponent`/`RigidBody2DComponent`, le `ScriptComponentRegistry`, son cache et son `release(entity)`, ainsi que les getters magiques `AtlasScript.transform`/`.rigidbody`, n'existent plus. Le modèle courant est le token apatride `defineScriptComponent` — cf. `docs/gameplay/scripting-components.md`. Tout ce qui concerne le **pont physique** (phases 0-1, 4-6) reste en vigueur.

## Points ouverts / risques

- ~~**`setComponent` vs cache de handle** (§3)~~ — **clos** : il n'y a plus de cache à périmer, le proxy re-résout à chaque accès (§3).
- **Téléport d'un `dynamic` avant création du body** — **traité** : `setPosition` écrit `Transform2D` d'abord, puis ne touche au body que si un `PhysicsBodyRef` existe déjà ; au 1er frame `Transform2D` sert de translation initiale à la création du body.
- **Scripts en lane `update` (variable) mutant un `dynamic`** : privilégier vélocité/force (appliquées au prochain `PhysicsStep`) ; réserver le téléport aux cas explicites, pour rester déterministe côté fixed.
