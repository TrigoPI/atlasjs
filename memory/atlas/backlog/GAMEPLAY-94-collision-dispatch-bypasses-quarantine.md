---
id: GAMEPLAY-94
status: todo
domain: gameplay
effort: S
verified: 2026-08-26
---

# Le dispatch de collision contourne le filtre et la quarantaine du `ScriptManager`

`PhysicsCollisionSystem.dispatch` (`packages/gameplay/src/systems/PhysicsCollisionSystem.ts:41-72`) demande `this.scripts.getScriptsByEntity(self)` (`:48-49`) puis appelle `script.onTriggerEnter?.(handle)` et ses trois voisins dans une boucle nue (`:57-71`). `ScriptManager.getScriptsByEntity` (`packages/gameplay/src/scripting/runtime/ScriptManager.ts:171-193`) ne filtre qu'une seule chose : `record.isDestroyed` (`:186`).

À comparer à `ScriptManager.runLifecycle` (`:300-324`), le chemin par lequel passent `onUpdate`, `onFixedUpdate` et le reste : il flushe les créations en attente (`:302`), filtre `!record.isCreated || record.isDestroyed || !record.isEnabled` (`:308`), et enveloppe chaque appel dans un `try/catch` qui bascule `record.isEnabled = false` et journalise via `describeFailure` (`:287-298`). Les callbacks de collision n'ont rien de tout ça. Trois écarts en découlent.

**(a) Aucune isolation d'erreur — actif.** Un `throw` dans un `onTriggerEnter` remonte tel quel : `dispatch` → `drainCollisions` → `PhysicsCollisionSystem.update` → `LaneSchedulerImpl.run` (`packages/core/src/public/engine/Scheduler.ts:89-100`, boucle sans `try`) → `Engine.startLoop` (`packages/core/src/public/engine/Engine.ts:252-266`, sans `try` non plus). **Vérifié : aucun `try` englobant n'existe en amont.** Un script fautif ne se met donc pas en quarantaine, il casse le pas fixe entier — alors que le même script levant dans `onUpdate` serait simplement désactivé avec un message nommant l'entité et la phase.

**(b) La quarantaine ne couvre pas les collisions — actif.** Un script désactivé par le `catch` de `runLifecycle`, ou par un `setEnabled(false)` explicite, continue de recevoir `onTriggerEnter`/`onCollisionEnter` : `isEnabled` n'est lu nulle part sur ce chemin. Un script déjà reconnu défaillant reste donc partiellement vivant, et peut continuer à muter l'état du jeu.

**(c) Callbacks avant `onCreate` — latent.** Le dispatch ne teste pas `record.isCreated`, alors que les créations sont différées jusqu'à `flushCreates` (`:326`). L'ordonnancement limite aujourd'hui la fenêtre : dans la voie `fixed`, `gameplay:script-fixed` est au stage `ScriptFixed` (`GameplayPlugin.ts:279-281`, anchor 150 dans `packages/core/src/public/engine/Stages.ts:5`) et `gameplay:physics-collision` au stage `PhysicsWriteback` (`GameplayPlugin.ts:330-332`, anchor 400) — un script attaché pendant la voie `update` est donc créé avant le dispatch suivant. Restent les attaches faites *depuis* un `onFixedUpdate` ou depuis un callback de collision lui-même : le record est en `pendingCreate`, et plus rien ne flushe avant `PhysicsWriteback`. Le script recevrait alors `onTriggerEnter` avec ses champs `requireComponent` encore `undefined`. Aucun script du dépôt n'est dans ce cas : `apps/dino-brawl/src/game/scripts/weapon/SwordHitboxScript.ts` — le seul consommateur réel de `onTriggerEnter`/`onTriggerExit` de l'app — **n'a pas d'`onCreate`** et n'initialise que son champ `targets` en `:6`, donc (c) est latent.

Piste : déplacer le dispatch dans `ScriptManager` sous la forme d'un `dispatchCollision(entity, handle, trigger, started)` qui réutilise exactement le filtre et le `try/catch`/`describeFailure` de `runLifecycle`, et ne laisser à `PhysicsCollisionSystem` que ce qui est vraiment de son ressort : la traduction `Collider → Entity` (`:26-27`) et la décision `trigger`/`started` (`:33`). L'alternative — recopier le filtre et le `try/catch` dans le système — coûte moins cher à écrire mais crée un second exemplaire de la politique de quarantaine, qui divergera. Le déplacement est le bon rapport valeur/coût ; à trancher au passage : `dispatchCollision` doit-il flusher les créations en attente comme le fait `runLifecycle`, ou seulement sauter les records non créés.

**Accroche :** `packages/gameplay/src/systems/PhysicsCollisionSystem.ts:57` — la boucle nue est le point d'entrée ; le code à réutiliser est juste à côté, dans `ScriptManager.ts:300-324`, et n'a pas besoin d'être écrit.

**À rapprocher de :** [[GAMEPLAY-89-collision-dispatch-mints-a-handle-per-contact]] — même méthode, même ligne d'appel ; les deux tickets se traitent naturellement ensemble, puisque déplacer le dispatch dans le `ScriptManager` est aussi l'endroit où poserait le cache `Entity → GameEntity` qu'y envisage `GAMEPLAY-89`.
