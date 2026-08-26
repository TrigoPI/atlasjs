---
id: GAMEPLAY-102
status: todo
domain: gameplay
effort: M
verified: 2026-08-26
---

# Les triggers n'émettent que des événements ponctuels, sans état de recouvrement

`PhysicsCollisionSystem` (`packages/gameplay/src/systems/PhysicsCollisionSystem.ts:23-72`) draine les contacts d'Inertia et les redistribue aux scripts sous la forme de quatre callbacks ponctuels — `onTriggerEnter`/`onTriggerExit`, `onCollisionEnter`/`onCollisionExit` (`:57-71`). Le système ne retient **rien** : ni la liste des paires en recouvrement, ni un composant, ni un cache. Le seul état conservé entre deux frames est celui d'Inertia, inaccessible au gameplay autrement que par ces événements.

Conséquence directe : tout script qui a besoin de la question « qui est *actuellement* dans ma zone ? » doit reconstruire la réponse à la main depuis les fronts montants et descendants. C'est exactement ce que fait `apps/dino-brawl/src/game/scripts/weapon/SwordHitboxScript.ts` (28 lignes en tout) : une `Map<Entity, GameEntity>` alimentée par `onTriggerEnter` (`:8-10`) et vidée par `onTriggerExit` (`:12-14`).

**Le point douloureux n'est pas la `Map`, c'est la purge.** `pruneDeadTargets` (`:21-27`) teste la vivacité d'une cible en sondant `handle.getComponent(Transform) === undefined`. Ce test ne repose sur aucun contrat : il exploite le fait qu'une entité détruite « perd » ses composants, donc que `getComponent` retombe sur `undefined`. Il est nécessaire parce qu'une entité détruite pendant qu'elle recouvre le hitbox n'émettra jamais son `onTriggerExit` — le collider disparaît avec elle et Inertia ne produit pas de front descendant que le système sache rattacher à un script encore vivant. Sans cette sonde, la `Map` fuiterait des handles vers des entités mortes et `MeleeHitResolver` les traverserait. Défaut **actif** : dans dino-brawl un ennemi meurt régulièrement sous la lame qui le touche.

La sonde alloue aussi. `Transform` est un `ScriptComponentToken` dont `create` est `new TransformHandle(world, entity)` (`packages/gameplay/src/scripting/components/Transform.ts:201-205`), et `GameEntityHandle.getComponent` l'appelle sans cache (`packages/gameplay/src/scripting/core/GameEntity.ts:53`) : **un handle neuf par cible vivante et par appel**. Et `getTargets()` (`:16-19`) fait un `Array.from(...)` à chaque appel, lui-même appelé par `MeleeHitResolver.resolve` (`apps/dino-brawl/src/game/scripts/combat/MeleeHitResolver.ts:41`) depuis `SwordScript.updateAttackingState` (`apps/dino-brawl/src/game/scripts/weapon/SwordScript.ts:153`) — donc **à chaque frame d'attaque**, hitstop mis à part. Ordre de grandeur modeste, mais non mesuré : ne pas s'en servir comme argument de priorisation.

Autour de ce noyau, l'app porte une couche de combat entièrement générique : `apps/dino-brawl/src/game/scripts/combat/` fait 341 lignes (`HurtReactionScript.ts` 185, `HurtboxScript.ts` 85, `MeleeHitResolver.ts` 68, `index.ts` 3), plus les 28 de `SwordHitboxScript.ts` — **369 lignes** sans une seule ligne spécifique au jeu dans `HurtboxScript` (i-frames, direction/knockback/hitstop du dernier coup) ni dans `MeleeHitResolver` (set anti-double-touche re-armable, résolution par `MeleeTargetSource`).

**Deux étages à distinguer, et ils ne se livrent pas ensemble.**

*L'étage bas — le vrai manque.* Un composant `TriggerOverlaps` rempli par `PhysicsCollisionSystem`, exposant `current()` / `entered()` / `exited()`. Il supprime à lui seul toute la reconstruction manuelle : `SwordHitboxScript` disparaît, et avec lui la sonde `Transform`, puisque c'est le système — qui voit les destructions — qui tient la liste. Il ne casse aucune API : les quatre callbacks existants restent. C'est peu de code, c'est là que se trouve le rapport valeur/coût, et **ça vaut d'être livré seul d'abord**.

*L'étage haut — utile mais discutable.* `Hitbox { arm(spec), disarm() }`, `Hurtbox { invincibilityDuration, grantInvincibility(d), takeHit(h), onHit(cb) }`, et un `HitInfo { source, direction, knockback, hitstop }` — la forme existe déjà presque telle quelle dans `HurtboxScript.ts:9-14` et `:58-78`. Ce niveau-là engage une opinion sur ce qu'est un combat, il mérite une discussion à part, et il n'est pas bloquant.

**Prérequis identifié.** [[CORE-08-nexus-on-before-destroy-signal]] est le levier qui rend la purge propre : un signal émis en tête de `destroyEntity` permettrait au système de retirer l'entité de tous les `TriggerOverlaps` qui la référencent, au lieu de laisser chaque consommateur sonder la vivacité. Sans lui, `TriggerOverlaps` devra faire la même sonde — mais **une fois, dans le moteur**, au lieu d'une fois par script de gameplay.

**Accroche :** `PhysicsCollisionSystem.ts:41-72` — `dispatch` connaît déjà `(self, other, trigger, started)`, c'est-à-dire exactement les quatre valeurs qu'il faut pour maintenir un `TriggerOverlaps` sur `self`. La rétention se pose à côté de la boucle de callbacks, sans la modifier.

**À rapprocher de :** [[GAMEPLAY-60-promote-weapon-attacks-to-package]] — elle propose de remonter `AttackTimeline`/`MeleeHitResolver` vers un package et raisonne « timeline d'attaque », sans jamais identifier que ce qui manque en dessous est la **rétention de recouvrement**. Les deux notes se rejoignent : `MeleeTargetSource` n'existe que parce que le moteur ne répond pas à `current()`. Et [[GAMEPLAY-89-collision-dispatch-mints-a-handle-per-contact]] — un `TriggerOverlaps` déplace le problème du handle par contact vers un handle par recouvrement retenu, donc le règle en passant.
