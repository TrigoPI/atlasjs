---
id: APP-17
status: todo
domain: app
effort: S
verified: 2026-08-26
---

# Les entités audio de course ne sont jamais détruites

`createRunningAudioPrefab` (`apps/dino-brawl/src/game/prefabs/fx/RunningAudioPrefab.ts:16-28`) construit une entité qui ne porte **qu'un `AudioSource`** en `playOnAwake` (`:19-23`) : pas de `Transform2D`, pas de script attaché. `RunningAudioPlayerScript` (`apps/dino-brawl/src/game/scripts/player/RunningAudioPlayerScript.ts:17-19`) en instancie une à chaque tir de son émetteur, et les intervalles hérités ne sont surchargés nulle part (`:12-13` — 0,5 s en marche, 0,4 s en course ; `apps/dino-brawl/src/game/prefabs/player/PlayerPrefab.ts:99-101` ne passe que `audioPrefab`). **Rien n'appelle jamais `destroy` sur ces entités.**

Le contraste avec la particule visuelle rend le trou évident : `RunningParticleScript` s'abonne au signal `finished` de son `Animator` et se détruit (`apps/dino-brawl/src/game/scripts/fx/RunningParticleScript.ts:18`, `:25-27`), tout comme `ImpactScript` (`apps/dino-brawl/src/game/scripts/fx/ImpactScript.ts:25`). Les deux émetteurs sont pilotés par le même `MovementEmitterScript` ; l'un se nettoie, l'autre non.

Côté moteur, rien ne rattrape la chose. `AudioSystem.sweepFinished` (`packages/gameplay/src/systems/AudioSystem.ts:81-88`) libère la **voix** terminée et remet `source.isPlaying` à `false`, mais laisse le composant et l'entité en place — c'est son contrat, `AudioSource` est un composant durable, pas un ticket de lecture. La query `world.query(AudioSource)` de `update` (`:23-26`) croît donc indéfiniment, et avec elle le coût par frame de `consumeCommand` + `pushLiveState` sur des sources définitivement muettes.

Second défaut au même endroit, vérifié : `createRunningParticlePrefab` ajoute un `AudioSource` sans `playOnAwake` et sans jamais appeler `play()` (`apps/dino-brawl/src/game/prefabs/fx/RunningParticlePrefab.ts:38`) — composant inerte, aucun son. Seul `playOnAwake` déclenche la lecture au réveil (`packages/gameplay/src/GameplayPlugin.ts:115-119`), et le `clip` de la particule est le même `grassSound` que celui du prefab audio (`apps/dino-brawl/src/game/spawn/spawnPlayer.ts:56-65`) : le son de pas passe donc entièrement par l'entité qui fuit, et le composant de la particule ne sert à rien.

Défaut **actif**, mais **non mesuré en runtime** : le raisonnement est statique — aucun appelant ne détruit ces entités, aucun script n'y est attaché pour le faire. Le scénario attendu est « courir 60 secondes → ~150 entités `running_audio` accumulées, zéro détruite » ; la confirmation demande un compteur d'entités dans `apps/dino-brawl/src/app/DebugOverlay.tsx`, qui n'affiche aujourd'hui que le FPS (`:15`). Trois correctifs possibles : attacher à ce prefab un script jumeau de `RunningParticleScript` qui écoute la fin de lecture (coût nul, corrige l'app seule) ; un composant d'auto-destruction côté moteur ([[GAMEPLAY-103-auto-destroy-component]]) ; ou, plus simplement, `AudioApi.playOneShot(clip, params)` — qui **existe déjà** (`packages/gameplay/src/scripting/services/AudioApi.ts:13-15`, adossé à `AudioEngine.playOneShot`, `packages/audio/src/AudioEngine.ts:78-92`), ne crée aucune entité, et se déconnecte seul sur `onended`. Trois scripts de l'app s'en servent déjà avec volume et pitch randomisés (`WeaponAttack.ts:81`, `PlayerDashScript.ts:182`, `HurtReactionScript.ts:164`) — c'est-à-dire exactement ce que fait ce prefab, en plus court. La fuite n'est donc pas un manque d'API : c'est un prefab qui aurait dû être un appel.

**Accroche :** `RunningAudioPrefab.ts:16-28` — le prefab tient en douze lignes et n'a aucun script ; c'est là que se voit d'un coup d'œil ce qui manque par rapport à `RunningParticlePrefab.ts:48`, qui attache le sien.

**À rapprocher de :** [[GAMEPLAY-103-auto-destroy-component]] — ce prefab en est le cas d'usage canonique, pour la part qui reste après le passage à `playOneShot` (le `RunningParticlePrefab`, lui, est bien une entité, et c'est son animation qui doit décider de sa mort).
