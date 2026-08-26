---
id: GAMEPLAY-109
status: vision
domain: gameplay
effort: L
verified: 2026-08-26
---

# Pas de système de particules : une entité complète par particule

Aucun système de particules n'existe dans le moteur — rien sous ce nom dans `packages/*/src`, et la liste des composants enregistrés par `GameplayPlugin` (`packages/gameplay/src/GameplayPlugin.ts:154-172`) va de `SpriteRender` à `OccluderStrip` sans jamais parler d'émetteur. `dino-brawl` simule donc à la main, avec un émetteur cadencé et un prefab jetable.

L'émetteur est `MovementEmitterScript` (`apps/dino-brawl/src/game/scripts/player/MovementEmitterScript.ts:38-56`) : il accumule un `clock` dans `onUpdate` et appelle `emit()` tous les `walkInterval`/`runInterval`. `RunningParticleSpawnerScript` (`apps/dino-brawl/src/game/scripts/player/RunningParticleSpawnerScript.ts:27-32`) le spécialise à 0,15 s / 0,09 s (`:15-16`) et fait un `instantiate` du prefab à chaque tick. Chaque particule est une entité complète : `Animator`, `AudioSource`, `SpriteRenderer`, `Transform2D` (`apps/dino-brawl/src/game/prefabs/fx/RunningParticlePrefab.ts:37-46`) plus un script attaché (`:48`), lequel entraîne l'ajout de `ScriptHost` et l'enregistrement d'un `ScriptInstanceRecord` (`packages/gameplay/src/scripting/runtime/ScriptManager.ts:68-113`). La particule se supprime elle-même en s'abonnant à l'événement `finished` de son `Animator` (`apps/dino-brawl/src/game/scripts/fx/RunningParticleScript.ts:18` et `:25-27`). Le même patron sert à `ImpactPrefab`/`ImpactScript` et à `RunningAudioPrefab`.

Le coût réel, à ce régime, est modeste : environ onze particules par seconde en course, chacune valant un `createEntity`, une allocation de `PrefabEntityBuilder` (`packages/gameplay/src/prefab/Instantiator.ts:30-31`), quatre insertions de store, une instance de script, un `GameEntity` handle (`:44`), puis la démolition symétrique quelques dixièmes de seconde plus tard. Pour un jeu 2D à cette densité, l'approche « une entité par particule » est **défendable et probablement la bonne** : tout reste uniforme, une particule est débogable comme n'importe quelle entité, elle profite gratuitement du tri, des layers et de l'animation, et le moteur ne porte pas un sous-système de plus.

Elle s'effondre en revanche dès qu'on veut des centaines de particules simultanées — pas à cause de la boucle de mise à jour mais du volume : autant de scripts dans le lifecycle, autant d'entrées dans quatre stores, autant de créations/destructions par frame, et surtout autant de draws si le renderer ne les fusionne pas. C'est le point où la question devient une question de **rendu** avant d'être une question de gameplay : un vrai système de particules ne vaut que s'il débouche sur un batch d'instances, et le dépôt a déjà deux notes qui balisent ce terrain — la table `BATCH_IDS` dupliquée entre renderers ([[RENDER-20-shared-blend-batch-ids]]) et le pool de buffers d'instances qui ne rétrécit jamais ([[RENDER-22-instance-buffer-pool-shrink]]).

`status: vision` pour cette raison : la décision dépend de ce que le moteur vise, elle traverse gameplay et rendering, et rien dans `dino-brawl` ne la réclame aujourd'hui. Il faut aussi noter qu'une réponse intermédiaire existe et coûte beaucoup moins cher — recycler les entités au lieu d'en créer, c'est-à-dire [[GAMEPLAY-91-prefab-instance-pooling]], qui cite explicitement les particules parmi ses cibles. À ne pas ouvrir avant qu'un cas d'usage réel tranche entre les deux.

**Accroche :** `apps/dino-brawl/src/game/prefabs/fx/RunningParticlePrefab.ts:35-49` — c'est la mesure exacte de ce que coûte une particule aujourd'hui, et donc l'étalon contre lequel toute proposition de système dédié doit se justifier. Compter ce qu'on économise réellement avant d'écrire quoi que ce soit.
