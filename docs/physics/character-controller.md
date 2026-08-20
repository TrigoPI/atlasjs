# Character Controller & solidité du monde — Design (v1)

> **Statut : implémenté, mergé dans `dev`.** Contrat `CharacterController` dans `@atlasjs/inertia`, backend `RapierCharacterController` (collide-and-slide via le `KinematicCharacterController` de rapier) dans `@atlasjs/rapier`, composants `CharacterController2D`/`CharacterControllerRef` dans `@atlasjs/gameplay`. Suite de [`collision-layer.md`](collision-layer.md) (Phase 1) — la « Phase 3 » solidité du monde.

## 1. Vue d'ensemble

Objectif : rendre le monde **solide**. Aujourd'hui le joueur traverse tout le décor — le Y-sort le fait *paraître* 3D mais on marche à travers les arbres/piliers. On veut qu'il **bute** dessus et **glisse** le long (collide-and-slide), façon Unity `CharacterController.Move()`.

Le joueur est un corps **kinematic position-based**. Or dans rapier un corps kinematic **n'est jamais bloqué** par la géométrie — il pousse les corps dynamiques mais traverse statique/kinematic. Le choix *position-based vs velocity-based ne change rien* à ça : les deux déplacent le corps exactement où on lui dit. La brique qui manque est le **character controller natif de rapier** (`KinematicCharacterController`) : un helper de requête qui, pour un déplacement voulu, calcule le déplacement **corrigé** (buté + glissé) contre les obstacles. Il ne déplace rien lui-même — on applique le résultat nous-mêmes.

La Phase 1 (`collision-layer.md`) a livré la détection d'**événements** (`onCollisionEnter/Exit`, `Collider2D` body-less = géométrie statique, layers nommés). Cette phase ajoute la **solidité**, orthogonale aux événements.

```
  @atlasjs/inertia (contrat)          @atlasjs/rapier (backend)         @atlasjs/gameplay (ECS/scripts)
  ┌───────────────────────────┐     ┌──────────────────────────┐     ┌────────────────────────────────┐
  │ CharacterController        │◄────│ RapierCharacterController │     │ CharacterController2D (config)   │
  │  .computeMovement(col, Δ)  │     │  wrappe KinematicChar-    │     │ CharacterControllerRef (handle)  │
  │ PhysicsWorld.create/destroy│     │  acterController + unités │     │ CharacterController (token .move)│
  │  CharacterController(opts) │     │                          │     │ PhysicsPushSystem: crée le ctrl  │
  └───────────────────────────┘     └──────────────────────────┘     └────────────────────────────────┘
                                                                        apps/dino-brawl : ingestColliders
                                                                        + calque Tiled `colliders`
```

## 2. Contexte — pourquoi kinematic ≠ solide

Rapier, corps kinematic : *« will push away any dynamic body in its path, but will not be stopped by them »*. Le `KinematicCharacterController` est décrit par rapier comme *« a character controller for controlling kinematic bodies and parentless colliders by hitting and sliding against obstacles »* — exactement notre cas (le joueur a un body kinematic + un collider attaché).

Le mapper confirme le setup : `map-rigid-body-desc.ts` → `case "kinematic": RAPIER.RigidBodyDesc.kinematicPositionBased()`. Position-based = le setup recommandé pour un character controller. **Aucun changement de body nécessaire.**

Différence avec le plugin Bevy (référence de la doc rapier) : le plugin fournit un *système* qui appelle `computeColliderMovement` puis applique `computedMovement` automatiquement. AtlasJS n'a pas ce plugin — **notre `move()` EST cette glue**.

## 3. Décisions verrouillées (brainstorm)

| # | Décision | Choix |
| --- | --- | --- |
| 1 | Mécanisme de solidité | **`KinematicCharacterController` natif de rapier** (collide-and-slide), pas de body dynamique, pas de dépénétration maison |
| 2 | Où vit la capacité | **`@atlasjs/inertia`** gagne un contrat `CharacterController` + `PhysicsWorld.createCharacterController/destroyCharacterController` ; backend dans `@atlasjs/rapier` |
| 3 | Forme de l'API composant | **Unity `move(delta)`, script-driven** : token comportemental (comme `Transform`) ; le collide-and-slide s'exécute dans `move()` et écrit le `Transform2D`. **Pas de nouveau système** — la création du controller se greffe sur `PhysicsPushSystem` |
| 4 | Source des colliders monde | **Nouveau objectgroup Tiled `colliders`** + nouvelle collision layer **`World`** (découple solidité et occlusion : murs invisibles possibles, buissons traversables possibles) |
| 5 | Nommage inertia | On **récupère le nom `CharacterController`** — l'actuel (helper plateforme gravité/saut/1D) est **du code mort (0 usage)** → supprimé |

## 4. `@atlasjs/inertia` — le contrat

Le `CharacterController` actuel (`CharacterController.ts`, un shaper de vélocité plateforme) et ses types `CharacterControllerOptions`/`CharacterControllerState` (dans `inertial-type.ts`) sont **supprimés** (0 usage vérifié). On réintroduit sous le même nom la vraie abstraction :

```ts
// CharacterController.ts
export interface CharacterController {
  computeMovement(collider: Collider, desired: Vec2): Vec2; // Δ corrigé, unités MONDE
}

// inertial-type.ts
export type CharacterControllerOptions = {
  offset?: number;  // skin width rapier-natif, unités PHYSIQUES (mètres), défaut 0.01, NON converti
  slide?: boolean;  // glisser le long des obstacles (défaut true)
};

// PhysicsWorld gagne :
createCharacterController(options?: CharacterControllerOptions): CharacterController;
destroyCharacterController(controller: CharacterController): void;
```

Le contrat reste **agnostique du backend** : pas de type rapier qui fuit, `computeMovement` prend/rend des `Vec2` en unités monde. `isGrounded`/pentes/autostep/snap-to-ground = concepts plateforme → **backlog**, hors v1 top-down.

## 5. `@atlasjs/rapier` — le backend

```ts
// RapierCharacterController.ts
export class RapierCharacterController implements CharacterController {
  // détient le RAPIER.KinematicCharacterController + le PhysicsUnitConverter
  computeMovement(collider: Collider, desired: Vec2): Vec2 {
    // 1. desired (monde) → physique via converter
    // 2. controller.computeColliderMovement(rapierCollider, deltaPhys, undefined, filterGroups)
    //    filterGroups = interaction-groups du collider joueur → le slide respecte le même mask
    // 3. controller.computedMovement() (physique) → monde via converter → retour
  }
}
```

- `RapierPhysicsWorld.createCharacterController(opts)` : `this.world.createCharacterController(opts.offset ?? 0.01)`, puis `setSlideEnabled(opts.slide ?? true)`. `offset` passé **tel quel** (rapier-natif, mètres) — pas de conversion.
- `destroyCharacterController` : `this.world.removeCharacterController(raw)` + retrait du registre interne (miroir de `destroyCollider`).
- **Conversion d'unités obligatoire** sur `desired` (monde→physique) et `computedMovement` (physique→monde) — même `PhysicsUnitConverter` que `RapierRigidBody`/`RapierCollider` (dino-brawl : `unitsPerMeter: 100`). C'est exactement le piège Phase-1 « raycast oublie ×`unitsPerMeter` ». L'`offset` seul reste non converti.
- `computeColliderMovement` **exclut automatiquement** le collider passé — le joueur ne se bloque pas sur lui-même.

## 6. `@atlasjs/gameplay` — composant + token

Miroir exact de la paire existante `RigidBody2D` (config) + `PhysicsBodyRef` (handle), et de `Collider2D` + `PhysicsColliderRef`. On respecte les **deux niveaux** (cf. `packages/gameplay/CLAUDE.md`).

**LEVEL-1 — `components/`**
```ts
// CharacterController2D.ts — config data-pure
export class CharacterController2D {
  public offset: number;   // rapier-natif (mètres), défaut 0.01
  public slide: boolean;   // défaut true
  public constructor(options?: { offset?: number; slide?: boolean });
}
// CharacterControllerRef.ts — handle vers l'inertia CharacterController (comme PhysicsBodyRef)
export class CharacterControllerRef {
  public readonly controller: CharacterController;
  public constructor(controller: CharacterController);
}
```

**LEVEL-2 — `scripting/components/`** — token comportemental justifié (behavior physique + autorité) :
```ts
// CharacterController.ts
export const CharacterController = defineScriptComponent(CharacterController2D, createCharacterController);
export type CharacterController = { move(delta: Vec2): Vec2 };

// createCharacterController(world, entity) → proxy stateless :
//   move(delta):
//     const ctrl  = world.requireComponent(entity, CharacterControllerRef).controller;
//     const col   = world.requireComponent(entity, PhysicsColliderRef).collider;
//     const t     = world.requireComponent(entity, Transform2D);
//     const moved = ctrl.computeMovement(col, delta);
//     t.position.x += moved.x; t.position.y += moved.y;   // autorité kinematic = Transform
//     return moved;
```
Le nom `CharacterController` coexiste sans conflit avec l'interface inertia du même nom — **exactement** comme `RigidBody` existe déjà en double (interface inertia + token gameplay `defineScriptComponent(RigidBody2D)`). Le token est **stateless** (re-résout à chaque accès), invariant maison respecté.

**Création du controller (extension de `PhysicsPushSystem`, pas de nouveau système)** : après la passe de création des colliders, une passe
```ts
world.query(CharacterController2D).without(CharacterControllerRef).each(entity => {
  const cfg = world.requireComponent(entity, CharacterController2D);
  const ctrl = this.inertia.createCharacterController({ offset: cfg.offset, slide: cfg.slide });
  world.addComponent(entity, CharacterControllerRef, ctrl);
});
```
**Teardown** : `world.onRemove(CharacterController2D, e => inertia.destroyCharacterController(ref))` enregistré dans `GameplayPlugin` (miroir du cleanup collider). Barrels : réexport `CharacterController2D`/`CharacterControllerRef`/token depuis `gameplay/src/index.ts`.

## 7. Flux par frame & ordonnancement

Deux lanes distinctes (vérifié dans `GameplayPlugin`/`InertialPlugin`) :

- **Lane `fixed`** (dt fixe) : `PhysicsRequest` → `PhysicsPushSystem` (`Transform2D → body/collider`, crée body/collider/**controller** manquants) ; `PhysicsStep` → `InertialPlugin.world.step()` ; `PhysicsWriteback` → `PhysicsPullSystem` + `PhysicsCollisionSystem` (draine `onCollisionEnter/Exit`, Phase 1, toujours actif en parallèle).
- **Lane `update`** (dt variable) : `Logic` → scripts. `PlayerMovementScript.onUpdate` → `this.character.move(v.scale(speed*dt))`.

Le character controller est une **requête** contre le monde tel que laissé par le dernier `step()` ; le collider joueur est à la position posée par le dernier push (`fixed`). `move()` écrit le `Transform2D` ; le prochain push repositionne le collider, le step suivant draine les events. **Latence ≤ 1 step fixe — identique au modèle actuel** (`transform.translate` en `update` + push en `fixed`) : on ne dégrade rien, on ajoute la correction de collision. Pas de `PhysicsPullSystem` pour le joueur (kinematic → autorité Transform). Résolution en lane `fixed` (0 latence, sweep juste après le push) → backlog si un jour la précision l'exige.

## 8. `apps/dino-brawl` — authoring & câblage

- `config.ts` : `defineCollisionLayers("Player", "Occluder", "World")`.
- **`game/tiled/ingestColliders.ts`** (calqué sur `ingestOccluders.ts`) : parcourt `doc.objects`, filtre les `RectObject` dont `groupPath.includes("colliders")` (ou `properties.collider === true`), `colliderFromRect(obj, MAP_SCALE)` → pour chaque : `createEntity` + `Transform2D`(position = coin monde du rect) + `Collider2D({ type: "box", width, height })` avec `layer = CollisionLayers.World`. Entité body-less → collider **statique** (cf. `PhysicsPushSystem` place les colliders body-less à `transform.position + offset`). Parenté à la `Grid` optionnelle (cohérent avec les strips occluders). Appelé par le `MapBuilder`/scène là où `ingestOccluders` l'est.
- `spawnPlayer.ts` : `nexus.addComponent(player, CharacterController2D)` ; `playerCollider.collidesWith = CollisionLayers.World` (le mask du filtre de slide). `PlayerMovementScript` : `this.transform.translate(...)` → `this.character.move(...)` (récupère le token `CharacterController` en `onCreate`).
- `maps/dino_brawl.json` : ajouter le objectgroup `colliders` (dans le groupe `systems`, à côté de `occluder_regions`) avec les rects solides. Box, pas point.

**Convention de placement box** (figée) : `Collider2D` `type:"box"` attend `width`/`height` et son centre = `transform.position + offset`. Le rect Tiled est en coin-haut-gauche → l'entité se place au **centre** du rect : `position = ((obj.x + obj.width/2), (obj.y + obj.height/2)) * MAP_SCALE`, `Collider2D.offset = (0,0)`, `width/height = obj.{width,height} * MAP_SCALE`. À valider visuellement au browser-verify.

## 9. Stratégie de test (TDD)

- **`@atlasjs/rapier` (test clé, GPU-free via wasm)** : monde + box statique `World` + `createCharacterController` ; un cercle sweepé **vers** la box → `computeMovement` renvoie un delta **clampé** (< desired) → prouve blocage + slide + **conversion d'unités**. Un sweep dans le vide → delta == desired. (Les fakes ne peuvent pas attraper ça — seul le vrai rapier le prouve, leçon Phase-1.)
- **`@atlasjs/inertia`** : le contrat n'a pas de comportement propre ; couvrir via `FakePhysicsWorld` étendu (renvoie un `computeMovement` canné) pour les tests gameplay.
- **`@atlasjs/gameplay`** : (a) `PhysicsPushSystem` minte `CharacterControllerRef` quand `CharacterController2D` présent ; teardown sur `onRemove`. (b) token `CharacterController.move(delta)` applique le delta corrigé (fake) au `Transform2D` et le renvoie. (c) stateless : deux accès successifs re-résolvent.
- **`apps/dino-brawl`** : `test/tiled/ingestColliders.test.ts` (miroir de `ingestOccluders.test.ts`) — rects sur `colliders` → N entités `Collider2D` box, `layer = World`, positions scalées ; ignore les autres objectgroups ; garde les rects sans nom.
- **Browser-verify (obligatoire)** : dans `dino-brawl`, le joueur bute sur les arbres/piliers et **glisse** le long ; zéro erreur console ; discipline `import type` (sinon écran noir Vite). Voir caveats sandbox (WebGPU lent/HMR stale → restart dev server).

## 10. Points de tuning (non bloquants)

- **Échelle** : collider joueur = cercle rayon 10 (fixe, n'hérite pas du sprite scale ×3) ; murs = rect Tiled × `MAP_SCALE(2)`. Cohérence à régler à l'œil au browser-verify (rayon joueur / épaisseur murs).
- **`offset`** : trop petit = jitter, trop grand = « flotte » loin des murs. Défaut 0.01 (unités physiques rapier-natives, mètres), à ajuster.
- **Sensors / événements** : les colliders `World` sont solides ; ils émettent aussi des events (Phase 1). Si un jour on veut « solide mais silencieux », ajouter un flag — backlog.

## 11. Non-objectifs / backlog

`isGrounded()` + `computedGrounded`, pentes/`maxSlopeClimbAngle`, `enableAutostep`, `enableSnapToGround`, `setApplyImpulsesToDynamicBodies` (pousser les corps dynamiques), `up` vector non-défaut (concepts plateforme) ; colliders **non-rectangulaires** depuis Tiled (polygones/ellipses) ; réutilisation optionnelle de `occluder_regions` comme solides ; multi-collider par entité ; character controller piloté par **système** (modèle Godot `move_and_slide`) si un jour plusieurs movers ; dépénétration des overlaps au spawn. Consigner dans [`../backlog/`](../backlog/).
