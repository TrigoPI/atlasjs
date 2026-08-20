---
id: PHYSICS-01
status: todo
domain: physics
source: "[[character-controller]]"
effort: L
verified: 2026-08-20
---

# Réglages avancés du character controller (sol, pentes, autostep, snap-to-ground, axe up)

Le contrat `CharacterController` d'inertia ne couvre que `offset`/`slide` : ni `isGrounded()`/`computedGrounded`, ni gestion de pente (`maxSlopeClimbAngle`), ni `enableAutostep`, ni `enableSnapToGround`, ni `setApplyImpulsesToDynamicBodies` (pousser les corps dynamiques rencontrés), ni axe `up` personnalisable — tous des réglages natifs du `KinematicCharacterController` de rapier, non exposés côté AtlasJS.

**Accroche :** `CharacterControllerOptions` (`packages/inertia/src/inertial-type.ts`) et `RapierCharacterController.computeMovement` (`packages/rapier/src/RapierCharacterController.ts`) donnent déjà le patron contrat/backend à étendre pour ces options.
