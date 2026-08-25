---
id: PHYSICS-15
status: todo
domain: physics
source: "[[gameplay-redesign]]"
effort: M
verified: 2026-08-25
---

# Les bodies kinematic sont téléportés au lieu d'être interpolés

`docs/gameplay/gameplay-redesign.md` §4 (table d'autorité, ligne 159) promet un push `Transform2D → body` via `setNextKinematicTranslation`. Or l'interface `RigidBody` d'inertia ne l'expose pas (`packages/inertia/src/RigidBody.ts:20-29`, aucune occurrence du symbole dans tout le repo) et `packages/gameplay/src/systems/PhysicsPushSystem.ts:82` appelle `body.setTranslation(...)`, que l'adapter mappe sur `rapierBody.setTranslation(t, true)` (`packages/rapier/src/RapierRigidBody.ts:78-90`) — un **téléport**.

Conséquences fonctionnelles : une plateforme kinematic ne **pousse pas** les bodies dynamic posés dessus (aucune vélocité de contact n'est générée) et les contacts sont résolus après pénétration. Le contrat d'autorité lui-même est respecté et vert (`test/physics-bridge.test.ts` vérifie que le transform poussé atteint bien le body) : ce qui manque, c'est le *mécanisme* promis, pas la règle.

**Accroche :** frontière de package. Ajouter `setNextKinematicTranslation(x, y)` à l'interface `RigidBody` de `@atlasjs/inertia`, l'implémenter dans `@atlasjs/rapier` (`RapierRigidBody.ts`, à côté de `setTranslation`), puis l'appeler depuis `PhysicsPushSystem.ts:82` quand `type === "kinematic"`. Alternative honnête si on ne veut pas le faire : corriger la table d'autorité du doc pour acter la limite.
