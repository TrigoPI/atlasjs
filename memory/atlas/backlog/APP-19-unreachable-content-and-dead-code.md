---
id: APP-19
status: todo
domain: app
effort: S
verified: 2026-08-26
---

# Contenu inatteignable et surface morte dans `apps/dino-brawl`

Inventaire vérifié par grep, pas un bug : rien de tout cela ne se manifeste en jeu. C'est de la surface **latente** — du code qui existe, compile, et n'est traversé par aucun chemin d'exécution du jeu.

- `apps/dino-brawl/src/game/content/weapons/rappierSwordCombo.ts:22` n'est référencé que par le barrel `content/weapons/index.ts:2`. Le seul combo instancié est `defaultSwordCombo` (`apps/dino-brawl/src/game/spawn/spawnPlayer.ts:91-95`).
- Conséquence : `LungeAttack` (`src/game/scripts/weapon/attacks/LungeAttack.ts:23`) et `ThrustChainAttack` (`.../ThrustChainAttack.ts:24`) ne sont attachés que depuis `rappierSwordCombo.ts:34` et `:45` — donc jamais en jeu, seulement dans `test/game/scripts/weapon/attacks/lungeAttack.test.ts` et `thrustChainAttack.test.ts`.
- Même conséquence pour les surcharges d'impact par attaque : `WeaponAttack.impactKnockback`/`impactHitstop` (`.../WeaponAttack.ts:47-53`) ne sont renseignées que par `rappierSwordCombo.ts:48-49`. `defaultSwordCombo` ne passe que `clip` et `pitch` (`defaultSwordCombo.ts:28-30`), donc les deux lectures de `SwordScript` (`.../SwordScript.ts:154` et `:196-197`) prennent **toujours** le repli. Les branches surchargées ne vivent que dans `test/game/scripts/weapon/swordScript.test.ts:401-465`, via une fausse attaque.
- `apps/dino-brawl/src/game/prefabs/fx/ImpactPrefab.ts:41` : `.sub(new Vec2(0, 0))` — soustraction sans effet, plus une allocation par impact.
- `apps/dino-brawl/src/game/prefabs/fx/RunningAudioPrefab.ts:21` : `pickRandom([deps.sound])` sur un tableau d'un seul élément — vestige d'un pool multi-clips.
- `apps/dino-brawl/src/game/loaders/AssetsLoader.ts:85-86` : le même asset chargé deux fois de suite. Sans conséquence — `AssetManager.load` mémoïse par `asset.id` et rend la promesse en cours (`packages/assets/src/AssetManager.ts:32-37`) — mais la ligne 85 ignore purement son résultat.
- `AssetsLoader.onAssetLoaded` (`.../AssetsLoader.ts:41-43`) : méthode publique jamais appelée. `ArenaScene` construit le loader (`src/game/ArenaScene.ts:29`), le remplit (`:62`) et l'attend (`:84`) sans jamais poser de callback ; `onAssetLoadedCb` reste `undefined` et `load()` termine sur un no-op (`:66`).
- Les écrans React orphelins de `src/app/` sont hors périmètre ici : voir [[APP-02-dino-brawl-dead-react-screens]].

Les cinq derniers points sont du nettoyage mécanique. Les trois premiers disent autre chose : ce qu'il y a de plus riche dans le système d'attaque — la chaîne de poussées, la fente, les surcharges d'impact par maillon — n'existe que sous test. C'est un signal sur la couverture réelle (des tests qui valident un contrat que le jeu n'exerce pas) plus que sur du code mort, et l'arbitrage est le même pour les trois : rebrancher le combo rapière sur une arme réelle, ou l'assumer comme fixture de test et le sortir de `content/`.

**Accroche :** `spawnPlayer.ts:91` — le seul site qui choisit un combo. C'est le point d'entrée parce que la décision « rapière jouable ou fixture » s'y prend en une ligne, et qu'elle détermine si les trois premiers points sont à supprimer ou à câbler.

**À rapprocher de :** [[GAMEPLAY-60-promote-weapon-attacks-to-package]] — si les attaques remontent vers un package, la frontière passe entre le moteur d'attaque et le contenu du jeu, et `rappierSwordCombo` devient un exemple de package plutôt qu'un orphelin d'app.
