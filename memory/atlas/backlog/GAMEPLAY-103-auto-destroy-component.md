---
id: GAMEPLAY-103
status: todo
domain: gameplay
effort: S
verified: 2026-08-26
---

# « Je me détruis quand mon animation finit » n'existe pas dans le moteur

Le patron le plus banal d'un FX one-shot — naître, jouer un clip, disparaître — n'a aucun support côté `gameplay`. Chaque effet doit donc porter son propre script, et dino-brawl en a écrit deux, à peu de choses près identiques :

- `apps/dino-brawl/src/game/scripts/fx/ImpactScript.ts:18-30` — `requireComponent(Animator)`, `animator.on("finished", () => this.destroy())`, `unsubscribe()` dans `onDestroy`.
- `apps/dino-brawl/src/game/scripts/fx/RunningParticleScript.ts:11-27` — mêmes trois lignes, la lambda passant par un `onFinished()` privé.

Le reste de chaque script est le vrai contenu du FX (jitter d'échelle : `ImpactScript.ts:19-22`, `RunningParticleScript.ts:12-16`) et n'a rien à voir avec la destruction. Le morceau dupliqué est petit — trois lignes plus un `onDestroy` — mais c'est trois lignes de gestion de cycle de vie qu'aucun auteur de jeu ne devrait avoir à réécrire, et **oublier l'`unsubscribe` ne se voit pas** : l'`EventBus` de l'`Animator` (`packages/gameplay/src/components/Animator.ts:12`) meurt avec le composant, donc l'oubli ne fuit pas ici, mais il fuiterait sur toute autre source d'événement.

**Piste :** un composant `AutoDestroy { afterSeconds?, onAnimationEnd?, onAudioEnd? }` plus un système. Une trentaine de lignes, aucun changement d'API existante.

**La question de conception qui décide de la forme.** `onAnimationEnd` suppose de savoir qu'un clip vient de finir. Aujourd'hui la seule voie est le signal : `Animator.tick` compare `isPlaying()` avant/après et émet `finished` (`Animator.ts:83-106`), et `AnimatorSystem.update` appelle ce `tick` pour chaque entité `(Animator, SpriteRender)` (`packages/gameplay/src/systems/AnimatorSystem.ts:15-29`). Deux formes possibles :

1. **Abonnement par entité.** Le système `AutoDestroy` s'abonne à `animator.on("finished", …)` au montage du composant. Ça marche, mais ça alloue une closure et une entrée d'`EventBus` **par instance de FX** — sur un chemin chaud (voir plus bas), et ça oblige le système à tenir une table `Entity → Unsubscribe` et à la nettoyer, c'est-à-dire à reproduire dans le moteur le `onDestroy` que les scripts font aujourd'hui.
2. **Drapeau balayé.** `Animator` retient un `justFinished` (nom de clip ou `null`) posé par `tick` au même endroit qu'il émet `finished` (`Animator.ts:101-102`), réarmé à chaque `tick`. Le système `AutoDestroy` le lit dans sa propre passe, après `gameplay:animator` (déjà ordonné `after: "gameplay:script-update"`, `packages/gameplay/src/GameplayPlugin.ts:300-304`). Zéro allocation par instance, zéro table à tenir, zéro désabonnement à oublier. Coût : un champ de plus sur `Animator` et une contrainte d'ordre entre deux systèmes — contrainte que le scheduler sait déjà exprimer.

**La seconde est la seule compatible avec du pooling** ([[GAMEPLAY-91-prefab-instance-pooling]]). Recycler une entité veut dire rejouer un `build` sur un composant `Animator` déjà présent ; avec la forme 1, chaque recyclage rouvre la question « faut-il se désabonner et se réabonner ? » et un oubli laisse une closure qui capture une entité aux données remplacées. Avec la forme 2, l'état vit dans le composant et se réinitialise avec lui. La forme 2 est aussi celle qui s'aligne sur le reste du moteur — `TileMap.revision` (`packages/gameplay/src/components/TileMap.ts:18-20`) est déjà ce genre de drapeau lu par un système plutôt qu'un signal poussé.

**Le cas que `AutoDestroy` aurait empêché existe déjà.** `createRunningAudioPrefab` (`apps/dino-brawl/src/game/prefabs/fx/RunningAudioPrefab.ts:15-28`) construit une entité qui ne porte **qu'un `AudioSource` en `playOnAwake`** — aucun script, donc rien qui la détruise jamais. `RunningAudioPlayerScript.emit` l'instancie toutes les `0.4 s` en course et `0.5 s` en marche (`apps/dino-brawl/src/game/scripts/player/RunningAudioPlayerScript.ts:12-19`), soit environ 2,5 entités mortes par seconde de déplacement, qui s'accumulent pour toute la durée de la partie. C'est le sujet de [[APP-17-running-audio-entity-leak]], mais c'est le même trou : `onAudioEnd` sur un `AutoDestroy` le refermait sans écrire un script.

**Accroche :** `packages/gameplay/src/components/Animator.ts:101-105` — le `if (wasPlaying && !nowPlaying)` est le seul endroit du moteur qui sait qu'un clip vient de se terminer. Poser le drapeau là, à côté de l'`emit`, décide de tout le reste de la note et ne casse aucun abonné existant.

**À rapprocher de :** `GAMEPLAY-96`, **livré** (voir [[scoped-time-and-timers]]) et donc sorti du backlog — `AtlasScript` expose désormais `stopwatch`/`countdown`/`every`, avancés avec le `dt` du périmètre de l'entité. `afterSeconds` est le même besoin vu depuis le composant plutôt que depuis le script, et doit s'appuyer sur ces primitives au lieu de compter son propre `dt`. Noter que la brique livrée n'inclut **pas** de `after(seconds, cb)` one-shot, écarté faute de site d'usage : c'est précisément celui qu'il faudrait ici. Et `GAMEPLAY-109`, **livré** (voir [[particles]]) et donc sorti du backlog — le système de particules dédié rend `AutoDestroy` inutile pour les particules, mais pas pour les FX one-shot comme `Impact`.
