---
id: PHYSICS-25
status: todo
domain: physics
source: "[[velocity-ownership]]"
effort: S
verified: 2026-09-04
---

# Téléporter un corps dynamique sans passer par le pont

Aucune API publique n'exprime « place ce corps ici ». `PhysicsPushSystem` ne pousse une translation que pour les corps `kinematic` et `static`, donc écrire `Transform2D.position` sur un dynamique est silencieusement écrasé par le pull suivant. Un script doit atteindre `PhysicsBodyRef.body.setTranslation()` — un composant du pont ECS ↔ physique — et écrire `Transform2D` en plus, pour que l'update suivant ne relise pas l'ancienne position.

**Accroche :** le respawn de `PlayerFallScript` (`apps/bump-royal/src/game/script/player/PlayerFallScript.ts`) fait exactement ce contournement et montre le besoin. `RigidBody2D` est le composant qui devrait le porter, à côté de `velocity` (§ 4.1 du doc de design).
