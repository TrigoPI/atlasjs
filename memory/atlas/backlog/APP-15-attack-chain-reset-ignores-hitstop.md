---
id: APP-15
status: todo
domain: app
effort: S
verified: 2026-08-26
---

# La fenêtre de reset du combo est comptée en temps mur, l'attaque en temps gelé

`SwordScript` gèle son horloge d'attaque pendant le hitstop : tant que `hitstopRemaining > 0`, il décompte et sort avant d'incrémenter `attackClock` (`apps/dino-brawl/src/game/scripts/weapon/SwordScript.ts:134-140`). `AttackChain`, lui, accumule son compteur dans son propre `onUpdate` sans rien savoir du gel (`apps/dino-brawl/src/game/scripts/weapon/attacks/AttackChain.ts:70-72`). Or c'est ce compteur qui décide du reset : `selectNextAttack` compare `elapsedSinceBegin` à `current.duration + resetDelay` (`:84-90`, `resetDelay` par défaut 0,5 s en `:12`). Le seuil est donc du **temps mur** confronté à une durée d'attaque mesurée sur une horloge **suspendue**.

Le décalage est exactement le hitstop cumulé du swing. `SwordScript` reste en état attaquant jusqu'à ce que `attackClock` atteigne `attackDuration` (`:161-164`), ce qui consomme `duration + hitstop` de temps réel, pendant que `AttackChain` en a déjà mangé autant sur un budget de `duration + 0,5`. Le joueur ne dispose donc que de `0,5 − hitstop` seconde de battement pour enchaîner, au lieu de `0,5`. Et le hitstop se cumule dans un même swing : dès qu'une attaque réarme ses touches (`TimelineAttack.ts:20-21, 57-58`, activé par `ThrustChainAttack.ts:50`), chaque impact réarme le résolveur (`SwordScript.ts:143-145`) et réécrit `hitstopRemaining` (`:154`). Avec assez de touches, la fenêtre se ferme avant même la fin visible du swing : le coup suivant repart au premier maillon au lieu d'enchaîner, sans que rien ne le signale.

Le défaut est **latent**. Le seul combo câblé est `defaultSwordCombo` (`apps/dino-brawl/src/game/spawn/spawnPlayer.ts:91`), dont les trois maillons ne passent aucun `hitstop` (`apps/dino-brawl/src/game/content/weapons/defaultSwordCombo.ts:26-32`) ; `impactHitstop` y vaut donc `undefined` (`attacks/WeaponAttack.ts:36, 51-53`), et le repli de `SwordScript` est `hitstopDuration`, à 0 par défaut (`SwordScript.ts:44`) et non renseigné par le prefab (`prefabs/weapon/SwordPrefab.ts:91-99`). `hitstopRemaining` reste donc constamment nul et les deux horloges ne divergent jamais. Le seul contenu qui déclare un hitstop est `rappierSwordCombo` (`content/weapons/rappierSwordCombo.ts:49`, `hitstop: 0.12` sur la `LungeAttack`), et il n'a aucun appelant hors du barrel. Changer une ligne — `defaultSwordCombo` → `rappierSwordCombo` en `spawnPlayer.ts:91` — rend le défaut actif : sur une `LungeAttack` de 0,52 s, la fenêtre tombe de 0,5 à 0,38 s, et le maillon `ThrustChainAttack` qui la précède réarme ses touches, donc cumule.

Trois corrections. Geler `AttackChain` comme `SwordScript` — le plus direct, mais il faudrait lui faire connaître un état qui appartient à un autre script, ce qui crée un couplage. Faire porter le compteur par `SwordScript`, qui possède déjà l'horloge gelée, et le passer à `begin()` — recentre la responsabilité, mais change la signature de `WeaponAttack`. Ou supprimer la classe entière de bug en donnant au moteur une échelle de temps périmétrée : les deux scripts liraient alors le même `dt` déjà gelé et la question ne se poserait plus. La deuxième est le meilleur rapport valeur/coût si la troisième n'est pas engagée à court terme.

**Accroche :** `apps/dino-brawl/src/game/scripts/weapon/attacks/AttackChain.ts:70-72` — trois lignes, et c'est la seule horloge de la chaîne. Le test qui échoue s'écrit sans moteur : un `AttackChain` monté sur un hitstop non nul, une frame de gel, et vérifier que le maillon suivant est bien le second.

**À rapprocher de :** [[GAMEPLAY-97-scoped-hitstop-timescale]], qui décrit la cause de fond — un gel réimplémenté dans l'app faute d'échelle de temps par périmètre — et cite ce cas comme démonstration.
