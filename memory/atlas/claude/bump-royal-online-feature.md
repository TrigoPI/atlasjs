---
name: bump-royal-online-feature
description: "bump-royal joue en ligne contre un serveur Node headless — mergé dans dev le 2026-09-07 (non poussé) ; le moteur Atlas tourne headless sans aucun travail moteur, et rien n'est entré dans packages/."
type: project
modified: 2026-09-07
---

Le 2026-09-06, livré **le multijoueur en ligne de `apps/bump-royal`** : branche
`feat/claude/bump-royal-online`, douze commits, poussée, **mergée dans `dev` le 2026-09-07
(`39b514d`) — `dev` n'est pas poussée**, conformément à l'habitude sur ce dépôt. Design :
[[state-sync]] (`status: implemented`) — le lire avant de toucher à cette chaîne, il porte les
treize pièges vérifiés par exécution, pas seulement le résultat.

**Le fait le plus réutilisable du chantier : un `Engine` Atlas tourne headless en Node
aujourd'hui, sans aucun travail moteur.** Un plugin `Provide` de quinze lignes et le stub
`{ createSampler: () => ({}), scene: new SceneGraph() }` satisfont le `requires: [NEBULA_RENDERER]`
de `GameplayPlugin` ; le gabarit est `packages/gameplay/test/helpers/harness.ts`, qui le fait déjà.
Rapier inline son wasm en base64, donc `RAPIER.init()` passe en Node. **Aucun plugin d'input n'est
nécessaire** : `PlayerInputSystem` résout `INPUT` *dans* son callback de query, jamais au
constructeur, donc jamais si aucune entité ne porte `PlayerInput`. Pas d'audio non plus
(`AudioSystem` résout paresseusement). Mais **pas de caméra** : `CameraSyncSystem` déréférence
`renderer.camera` et casse le stub.

Ce qui a été décidé et tenu : autorité serveur (obligatoire — le bump *est* le solveur rapier,
donc aucune autorité distribuée n'est possible), state sync sans prédiction, **une seule app** avec
le serveur dans `src/server/` pour qu'il partage les scripts par chemin relatif, et **rien dans
`packages/`**. L'extraction d'un `@atlasjs/net` reste volontairement repoussée.

Trois seams portent tout : `MoveIntent` (la sim lit un snapshot d'intention par tick, plus un
périphérique — ce qui contourne [[GAMEPLAY-29-input-fixed-lane-sampling]] sans le clore),
`PlayerStatus` (l'état répliquable en composant, qui remplace `getScript(...)` : une référence de
script ne se réplique pas), et la coupe `src/game/sim/` / `src/game/view/` **garantie par le
compilateur** — `tsconfig.server.json` a un `lib` sans `"DOM"`, donc un `window` sous `sim/` ne
type-checke pas.

**Le piège qui coûte le plus cher sur ce projet, rencontré deux fois :** `ScriptManager` attrape
les exceptions de `onCreate`, **désactive le script et se contente de logger**. Un script sim qui
appelle `getService(AudioApi)` ou `requireComponent(RigidBody)` là où l'objet n'existe pas
disparaît donc *en silence* — le serveur continue à diffuser des joueurs inertes, ce qui ne
ressemble pas du tout à une erreur. C'est arrivé sur `PlayerSoundScript` (un `requireComponent`
sur le prefab sans corps). La parade est une spec qui asserte `ScriptManager.isEnabled` sur tous
les scripts après N ticks — voir aussi [[mutation-test-gameplay-specs]], parce que ce canari-là
naît vacue.

Suites déposées : [[NETWORK-01-client-prediction-reconciliation]],
[[NETWORK-02-binary-encoding-and-deltas]], [[NETWORK-03-reconnect-and-clock-drift]].
