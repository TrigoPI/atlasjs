---
id: GAMEPLAY-104
status: todo
domain: gameplay
source: "[[sprite-animation]]"
effort: M
verified: 2026-08-26
---

# `SpriteAnimation` porte l'état de lecture dans la définition du clip

`SpriteAnimation` (`packages/nebula/src/animations/SpriteAnimation.ts:6-30`) mélange deux choses dans un seul objet. Immuable : `frames`, `frameDuration`, `loop` (`:7-9`, tous `readonly`). Mutable : `currentFrameIndex`, `playing`, `elapsedMs` (`:11-13`), réécrits par `play`/`stop`/`pause`/`resume`/`tick` (`:48-77`). Un clip **est** son curseur de lecture.

Il n'est donc pas partageable. Deux entités qui reçoivent la même instance partagent l'index de frame et le drapeau `playing` : elles s'animent en lockstep, et le `stop()` de l'une arrête l'autre. `AnimationPlayer` (`packages/nebula/src/animations/AnimationPlayer.ts:26-33`) se contente de ranger les instances dans une `Map`, sans les copier ; `Animator` (`packages/gameplay/src/components/Animator.ts:14-25`) prend un `Record<string, SpriteAnimation>` et les y verse. La preuve que le moteur en souffre est dans `Animator.tick` (`:93-99`), qui doit **relire l'état de lecture sur le clip** — `animation.isPlaying()`, `animation.getCurrentFrameIndex()` avant/après — pour deviner qu'un clip a fini ou bouclé. Si l'état vivait dans l'`Animator`, cette comparaison serait locale et il n'y aurait rien à sonder.

**La cascade côté app.** Comme un clip ne se partage pas, dino-brawl a bâti une fabrique : `SheetLoader.createClips(name)` (`apps/dino-brawl/src/game/sheets/SheetLoader.ts:37-45`) refabrique l'**enregistrement complet** de clips à chaque appel, via un type `ClipBuilder = (sheet) => Record<string, SpriteAnimation>` (`apps/dino-brawl/src/game/sheets/sheets/sheets.types.ts:5-7`). La conséquence est une prop `clips` traînée à travers toute l'arborescence de construction — **26 mentions dans 10 fichiers** (`grep -rn clips apps/dino-brawl/src --include='*.ts'`, hors `content/weapons/`) :

- le type et le registre : `sheets.types.ts:5-7,13`, `SheetLoader.ts:8,33,44`, `SheetList.ts:14,20,26,32` ;
- en `Record<string, SpriteAnimation>` (une seule instanciation) : `prefabs/player/PlayerPrefab.ts:42,77`, `prefabs/enemy/EnemyPrefab.ts:27,52` ;
- en `() => Record<string, SpriteAnimation>` (une fabrique, rappelée à chaque instanciation) : `prefabs/fx/ImpactPrefab.ts:19,33`, `prefabs/fx/RunningParticlePrefab.ts:22,36-37`, `scripts/enemy/SpawnEnemyScript.ts:26,34,54` ;
- les appels : `spawn/spawnPlayer.ts:58,76`, `spawn/spawnEnemy.ts:46,58,67`.

(Les `clips` de `content/weapons/*.ts` sont des `AudioClip` de combo, sans rapport — exclus du compte.)

La forme `() => Record<…>` n'est pas un raffinement : c'est la seule qui marche pour un prefab instancié plusieurs fois. `ImpactPrefab.build` appelle `opt.clips()` à chaque construction (`:33`), `RunningParticlePrefab.build` aussi (`:36`).

**Coût runtime — énoncé, mais pas mesuré.** Chaque instanciation de FX rejoue la fabrique : un littéral d'enregistrement, un `new SpriteAnimation` par clip, et un `Frame[]` neuf par clip via `SpriteSheet.getManyInRange` (`packages/nebula/src/animations/SpriteSheet.ts:45-56`, qui construit et remplit un tableau à chaque appel — les `Frame` eux-mêmes restent partagés). Pour la particule de course c'est 1 clip de 8 frames, émis toutes les `0.09 s` en course et `0.15 s` en marche (`apps/dino-brawl/src/game/scripts/player/RunningParticleSpawnerScript.ts:15-16`, intervalle consommé par `MovementEmitterScript.onUpdate:38-56`) — de l'ordre de 11 spawns par seconde de sprint, chacun payant sa fabrique. Pour l'impact, un par coup porté.

**Ce chiffre est un ordre de grandeur, pas une mesure.** Aucun profil n'a été pris sur ce chemin. La méthode à appliquer avant d'en faire un argument de priorisation est consignée dans [[GAMEPLAY-89-collision-dispatch-mints-a-handle-per-contact]] et rappelée par [[GAMEPLAY-91-prefab-instance-pooling]] : profileur d'allocation échantillonné (`HeapProfiler.startSampling` avec `includeObjectsCollectedByMajorGC`/`MinorGC` à `true`), frames *builtin* repliées sur leur ancêtre JS — et **surtout pas** un delta `heapUsed`, qui a donné des résultats inversés deux fois sur ce moteur. Le vrai argument de cette note reste la correction du modèle, pas la performance : la performance en découle.

**Piste.** Séparer `AnimationClip` — `{ frames, fps, loop }`, immuable, partageable — de l'état de lecture, porté par l'`Animator` (index, `elapsedMs`, `playing`, un par entité). Puis une `AnimationLibrary` construite **une fois** depuis une spritesheet, injectée telle quelle dans chaque prefab. Côté app, ces 26 mentions se réduisent à une bibliothèque passée par référence, `ClipBuilder` et `createClips()` disparaissent, et la distinction `Record` / `() => Record` n'a plus de raison d'être.

**C'est la seule note du lot qui casse une API publique.** `new SpriteAnimation(options)` et `new Animator(clips, initial)` sont tous deux publics et utilisés hors du moteur. Proposition : garder `SpriteAnimation` en façade dépréciée le temps d'une version — un clip immuable plus son curseur, mêmes signatures — pour ne pas forcer une migration au même commit. Et rappel opératoire : `nebula` **et** `gameplay` doivent voir leur `dist` rebâti (`pnpm --filter @atlasjs/nebula build`, puis `gameplay`) avant que `apps/dino-brawl` ne type-check, sans quoi l'app continue de voir l'ancienne API.

**Ce que les notes voisines ne couvrent pas.** [[ASSETS-02-animation-asset-serialization]] veut un `AnimationAsset` sérialisable : c'est le **chargement** d'un clip depuis un fichier, en aval — et elle devient nettement plus simple si ce qu'on désérialise est un objet immuable sans curseur. [[GAMEPLAY-08-animator-sprite-cache-eviction]] porte sur le `Map<Frame, Sprite>` d'`AnimatorSystem`, c'est-à-dire le cache de sprites en sortie, pas la définition des clips en entrée. Ni l'une ni l'autre ne touche à la mutabilité du clip.

**Accroche :** `packages/nebula/src/animations/SpriteAnimation.ts:11-13` — les trois champs mutables. Les déplacer vers `Animator` et rendre le reste `readonly` fait tomber, dans l'ordre, `AnimationPlayer.play` (`:49-73`, qui ne fait que du `stop`/`play` sur des clips), la sonde d'état de `Animator.tick` (`:93-99`), puis `ClipBuilder` côté app.
