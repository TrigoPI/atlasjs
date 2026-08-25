---
id: PHYSICS-13
status: todo
domain: physics
source: "[[gameplay-redesign]]"
effort: M
verified: 2026-08-25
---

# `Collider2D` et `CharacterController2D` sont exposés comme de la donnée vivante mais figés à la création

`packages/gameplay/src/systems/PhysicsPushSystem.ts:87-115` : `buildColliderDesc` n'est appelé que dans la boucle de création (`:95`), et **aucune query `(Collider2D, PhysicsColliderRef)` n'existe**. Toute mutation ultérieure de `isSensor`, `layer`, `collidesWith`, `friction`, `restitution`, `density`, `offset` ou `shape` est donc **silencieusement ignorée**, alors que `packages/inertia/src/Collider.ts:11-17` expose bien `setSensor`/`setCollisionGroup`/`setCollisionMask`/`setFriction`/`setRestitution`/`setDensity`. `Collider2D` a 9 champs publics mutables (`packages/gameplay/src/components/Collider2D.ts:5-13`) et est exporté tel quel dans l'API de script (`src/scripting/components/index.ts:4-5`). Cas d'usage évident d'un auteur de jeu : « je passe mon collider en sensor pendant l'invincibilité » → ne fait rien.

Même problème pour `CharacterController2D.offset`/`slide` (`packages/gameplay/src/components/CharacterController2D.ts:2-3`), lus une seule fois à la création du contrôleur (`PhysicsPushSystem.ts:106-113`). Et un `Collider2D` **sans** body n'est jamais repositionné — `buildColliderDesc` ne lit `Transform2D` qu'à la création (`:152-157`) : une entité mobile sans `RigidBody2D` traîne un collider figé à son point de spawn. Rien de tout cela ne remet en cause le contrat d'autorité du pont (dynamic → physique ; kinematic et static → `Transform2D`), verrouillé par `test/physics-bridge.test.ts`.

**Accroche :** ajouter une passe de synchronisation dans `PhysicsPushSystem.update` (après la boucle de création, `:100`) poussant les 6 propriétés supportées par l'interface `Collider`, et passer `shape`/`offset` en `readonly` dans `Collider2D` — ils exigent une recréation, donc le compilateur doit le dire.
