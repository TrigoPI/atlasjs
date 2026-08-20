# Collision Layer — Design (v1)

> **Statut : implémenté (Phase 1), mergé dans `dev`.** `CollisionLayers` (membership/filtre nommés) dans `@atlasjs/inertia`, backend rapier correct (filtrage par groupes, drain d'événements, `userData`) dans `@atlasjs/rapier`, bridge ECS (`Collider2D`, `PhysicsColliderRef`, `PhysicsCollisionSystem` → `onCollisionEnter/Exit`/`onTriggerEnter/Exit` sur les scripts) dans `@atlasjs/gameplay`. Suite : la solidité du monde (Phase 3) → [`character-controller.md`](character-controller.md).

## 1. Contexte & problème résolu

Un audit d'`@atlasjs/inertia` + `@atlasjs/rapier` a trouvé que le chemin rigid-body était sain mais que **la moitié « collision » n'était qu'un squelette jamais câblé ni exercé**, avec trois bugs latents posés exactement sur le chemin de la feature suivante (solidité du monde, cf. `character-controller.md`) :

1. **Le filtrage était sans effet.** `RapierCollider.setCollisionMask` routait vers `setSolverGroups` — un axe rapier différent (réponse physique, pas détection) — et `mapColliderDesc` n'appliquait jamais `collisionGroup`/`collisionMask`/`userData` à la création. Résultat : déclarer des layers ne changeait rien au comportement.
2. **Le raycast ignorait la conversion d'unités** — faux d'un facteur `unitsPerMeter` (100 dans `dino-brawl`) ; `intersectPoint`/`intersectAABB` étaient des stubs silencieux (`[]`).
3. **Aucun événement de collision, aucun `Collider.userData`, aucun `Collider2D` gameplay** — des bodies existaient mais rien n'entrait en collision, et rien ne pouvait relier un contact rapier à une `Entity` du jeu.

Le problème n'était donc pas une feature à construire from scratch mais une **abstraction physique à réparer** avant de pouvoir la brancher sur l'ECS. Domaine explicitement laissé de côté à ce stade : sommeil/dirty-flag et le command buffer « sync par intention » (perf), les colliders composés/fusionnés de tilemap (feature solidité du monde à part), les joints, et un nettoyage d'hygiène plus large (code mort, `ensure-rapier-init`, dépendances inutilisées) volontairement non absorbé ici pour garder le plan resserré sur les trois bugs.

## 2. Décisions de design

| # | Décision | Choix |
| --- | --- | --- |
| 1 | Où vivent les couches | **`defineCollisionLayers` dans `@atlasjs/inertia`** — contrat agnostique du backend, noms résolus en bits, jamais un type rapier qui fuit |
| 2 | Notification de jeu | **Callbacks Unity-style sur les scripts** : `onCollisionEnter/Exit`, `onTriggerEnter/Exit` |
| 3 | `Collider2D` sans body | **= géométrie statique du monde** (pas de `RigidBody2D` requis) — permet des colliders de décor sans payer un body dynamique |
| 4 | Événements | **activés par défaut** sur tout collider créé par le bridge gameplay (`events: true`) |
| 5 | Contact → jeu | **`Collider.userData` porte l'`Entity`** propriétaire — seul pont entre un contact rapier et le monde ECS |

## 3. `@atlasjs/inertia` — le contrat

```ts
function defineCollisionLayers<const K extends string>(...names: K[]): CollisionLayers<K>;
// 1 bit par nom, dans l'ordre ; throw au-delà de 16 layers (masque 16 bits)
const ALL_LAYERS: CollisionMask; // 0xffff
const NO_LAYERS: CollisionMask;  // 0x0000

interface Collider {
  getUserData<T = unknown>(): T | undefined;
  setUserData(data: unknown): this;
  // + collisionGroup/collisionMask/sensor/friction/restitution/density existants
}

type CollisionHandler = (a: Collider, b: Collider, started: boolean) => void;
interface PhysicsWorld {
  drainCollisions(handler: CollisionHandler): void;
}
```

Le contrat reste backend-agnostique : `userData` est `unknown` côté inertia (c'est le bridge gameplay qui décide qu'il s'agit d'une `Entity`), et `drainCollisions` ne présuppose rien sur la façon dont un backend collecte ses événements.

## 4. `@atlasjs/rapier` — le backend

- **`packCollisionGroups(membership, filter)`** : rapier n'expose qu'un seul entier `collisionGroups` pour la détection (membership dans les 16 bits hauts, filtre dans les 16 bits bas, valeur `u32`) — c'est l'unique axe correct, distinct de `solverGroups` (réponse physique). Le bug originel appelait `setSolverGroups` : la détection n'a jamais été affectée par les layers déclarés.
- **`RapierPhysicsWorld`** : une `EventQueue` alimentée à chaque `step`, drainée par `drainCollisions` (résout les handles rapier vers les `RapierCollider` connus, ignore silencieusement un handle disparu). `destroyRigidBody` retire aussi les colliders attachés de la map JS (fuite corrigée) ; `destroyCollider` est idempotent (teardown order-independent, un collider déjà retiré ne throw pas).
- **`RapierPhysicsQuery`** : `raycast`/`intersectPoint`/`intersectAABB` convertissent systématiquement via `PhysicsUnitConverter` (origine/distance en entrée, `toi` en sortie) — c'est exactement la conversion que le raycast d'origine oubliait.
- **Test unitaire vs réel** : le comportement WASM de rapier n'a pas de harnais de test unitaire (pas de setup WASM en test). Seul `packCollisionGroups` (logique pure) est testé unitairement ; le filtrage réel, les événements et les requêtes sont validés par le build + un browser-verify sur `dino-brawl` avec le vrai moteur — voir le caveat `ActiveCollisionTypes` (§8) que seul ce browser-verify a révélé.

## 5. `@atlasjs/gameplay` — le bridge ECS

**LEVEL-1 — `Collider2D`** (data-pure) : `shape: ColliderShapeDesc`, `offset: Vec2`, `rotation: number`, `isSensor: boolean`, `layer: number = ALL_LAYERS`, `collidesWith: number = ALL_LAYERS`, `friction: number = 0.5`, `restitution: number = 0`, `density: number = 0`.

**LEVEL-2 — alias script `Collider`** : identity token (`defineScriptComponent(Collider2D)`, pas de factory) — `Collider2D` est data-pure, il n'y a pas de comportement à cacher derrière un proxy.

**`PhysicsColliderRef`** : handle vers le `Collider` inertia créé, miroir exact de `PhysicsBodyRef`.

**Création** : une passe ajoutée à `PhysicsPushSystem` (pas de nouveau système) — pour chaque `Collider2D` sans `PhysicsColliderRef` : si un `RigidBody2D`/`PhysicsBodyRef` existe, le collider est attaché au body ; sinon il est positionné **une seule fois, à la création**, depuis le `Transform2D` résolu (translation composée avec la hiérarchie) — c'est cette absence de body qui en fait de la géométrie statique. `userData` reçoit l'`Entity`, `events: true` par défaut.

**Teardown symétrique** (`onRemove` dans `GameplayPlugin`) : retirer `Collider2D` retire `PhysicsColliderRef` ; retirer `PhysicsColliderRef` appelle `inertia.destroyCollider`.

**Dispatch** — `PhysicsCollisionSystem` (nouveau système, lane `fixed`, stage `PhysicsWriteback`, après `gameplay:physics-pull`) : draine `drainCollisions`, résout les deux `Entity` via `userData` (ignore la paire si l'une est absente), route vers `onTriggerEnter/Exit` si **l'un ou l'autre** collider est `sensor`, sinon vers `onCollisionEnter/Exit` ; dispatch fait **symétriquement** aux deux entités (chacune reçoit l'autre en `GameEntity`).

## 6. Invariants à ne pas casser

- **Sens de dépendance** : `rapier → inertia`, `gameplay → inertia` ; `inertia` n'importe jamais `rapier` ni `gameplay`.
- **`userData` = `Entity`** sur tout collider créé par le bridge gameplay — c'est le seul pont contact→jeu ; le détourner pour autre chose casserait `PhysicsCollisionSystem`.
- **`Collider2D` sans `RigidBody2D` = statique**, par design (§2#3), pas par omission — la solidité (blocage physique) d'un body kinematic est hors périmètre ici, voir §8.
- **`packCollisionGroups`** : contrat *membership = 16 bits hauts, filtre = 16 bits bas* — implicitement lié à l'unique primitive `collisionGroups` de rapier2d-compat (pas de `solverGroups` pour la détection).

## 7. Ordonnancement runtime

Lane `fixed`, stage `PhysicsWriteback`, dans l'ordre : `gameplay:physics-pull` (écrit les transforms depuis la physique) → `gameplay:physics-collision` (drains + dispatch). La création de colliders, elle, a lieu plus tôt dans la même lane, dans la passe `PhysicsRequest` de `PhysicsPushSystem`, aux côtés de la création de bodies.

## 8. Caveats connus (Phase 1)

- **Un collider statique (body-less) ne suit pas un `Transform2D` qui bouge après coup** — il n'est positionné qu'à la création. Une entité qui doit bouger a besoin d'un `RigidBody2D`.
- **Retirer `RigidBody2D` en gardant `Collider2D` laisse un `PhysicsColliderRef` périmé** (pas de repositionnement automatique en statique). Contournement : retirer puis rajouter `Collider2D` pour le recréer.
- **Un body kinematic détecte (les events partent) mais n'est pas physiquement bloqué** — la réponse « solide » pour un joueur piloté par script est le sujet de [`character-controller.md`](character-controller.md) (Phase 3).
- **`ActiveCollisionTypes` par défaut de rapier (`DEFAULT`) n'active que les paires `DYNAMIC_*`.** Notre cas principal — un kinematic script-driven contre un statique/body-less (le joueur vs le décor) — n'émettait donc **aucun événement** tant que `mapColliderDesc` ne posait pas explicitement `setActiveCollisionTypes(ActiveCollisionTypes.ALL)` à côté de `setActiveEvents`. C'est exactement la classe de bug qu'un test unitaire sur fake ne peut pas attraper (le fake court-circuite rapier) — seul le browser-verify sur le vrai moteur l'a révélé. `ALL` active aussi `FIXED_FIXED`, superflu/bruyant pour une grande tilemap statique — à restreindre (ex. `DEFAULT | KINEMATIC_FIXED | KINEMATIC_KINEMATIC`) quand les colliders de tilemap arriveront.

## 9. Non-objectifs / suite (→ `docs/backlog/`)

- Sommeil/dirty-flag & command buffer « sync par intention » (perf).
- Colliders composés/fusionnés pour tilemap (solidité du monde — feature dédiée).
- Joints.
- Nettoyage d'hygiène (code mort, `ensure-rapier-init`, dépendances inutilisées, `dispose()`/`world.free()`) — volontairement pas absorbé par ce plan.
- Restreindre `ActiveCollisionTypes` pour les grandes tilemaps statiques (§8).
