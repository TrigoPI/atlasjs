---
id: PHYSICS-14
status: todo
domain: physics
source: "[[gameplay-redesign]]"
effort: M
verified: 2026-08-25
---

# `CharacterController.move()` calcule contre un collider qui n'avance qu'à la lane fixed

`packages/gameplay/src/scripting/components/CharacterController.ts:38-48` : `move()` lit la position **courante du collider dans le monde rapier**, calcule le collide-and-slide, puis écrit `Transform2D`. Mais le collider ne bouge que quand `PhysicsPushSystem` pousse `Transform2D → body` en lane `fixed` (`packages/gameplay/src/systems/PhysicsPushSystem.ts:80-84`), et `advanceFixed` peut exécuter **zéro** step sur une frame donnée (`packages/core/src/public/engine/Engine.ts:268-277`, la boucle ne tourne que si `acc >= fixedDelta`). Plusieurs `move()` consécutifs partent donc de la **même** position de collider alors que `Transform2D` a déjà avancé : au contact d'un mur, chaque appel re-clampe depuis un point de départ périmé et **le personnage franchit le mur** d'autant de fois qu'il y a de frames `update` sans step fixe. Le backend est bien position-based sur le collider (`packages/rapier/src/RapierCharacterController.ts:29-34`, `computeColliderMovement`).

Trois usages réels sont concernés, tous appelés depuis la lane `update` : `apps/dino-brawl/src/game/scripts/player/PlayerMovementScript.ts:56`, `PlayerDashScript.ts:167` (via `advance()`, appelé en `onUpdate`) et `apps/dino-brawl/src/game/scripts/combat/HurtReactionScript.ts:138` (via `advanceKnockback()`, idem). Le contrat d'autorité du pont n'est pas en cause — c'est le chemin character controller, qui court-circuite le push, qui l'est.

**Accroche :** dans `CharacterController.ts:43-46`, après l'écriture du `Transform2D`, pousser immédiatement le body dans `move()` (`world.getComponent(entity, PhysicsBodyRef)?.body.setTranslation(...)`) — ~5 lignes, rend l'appel idempotent multi-appels. Test : deux `move()` vers un mur dans la même frame doivent donner la même position finale qu'un seul.

**À rapprocher de :** [[PHYSICS-08-character-controller-tuning-remarks]] — celui-là note la *latence* d'un step fixe comme acceptée ; ici il s'agit d'un défaut de correction, pas de latence.
