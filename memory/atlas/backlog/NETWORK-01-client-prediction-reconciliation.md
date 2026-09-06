---
id: NETWORK-01
status: vision
domain: network
source: "[[state-sync]]"
effort: L
verified: 2026-09-06
---

# Prédiction client et réconciliation

La V1 rend le joueur local depuis le flux serveur, donc son propre dash part avec
~100 ms de délai de rendu + RTT/2, y compris en localhost. Reste à simuler localement
le joueur possédé, garder un anneau d'inputs, et rejouer depuis le dernier tick confirmé
quand le serveur corrige.

**Accroche :** le protocole porte déjà `InputFrame.t` et `ServerSnapshot.ack` sans les
consommer, et `PlayerStatus` porte déjà `dashRemaining` / `cooldownRemaining` hors du fil —
la réconciliation sera une écriture de composant, pas un refactor de scripts. Le seam moteur
est `Engine.advanceFixed`, cf. [[CORE-04-rollback-driver]].

**Le piège à écrire avant de commencer :** pendant une chute, `PlayerFallSimScript` met
`collidesWith` à `0`. Un client qui prédit sans reproduire ce basculement prédira des bumps
que le serveur n'a pas eus, et se réconciliera d'une secousse visible à **chaque** chute.
