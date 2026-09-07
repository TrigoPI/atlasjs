---
id: APP-28
status: todo
domain: app
source: "[[velocity-ownership]]"
effort: S
verified: 2026-09-06
---

# bump-royal — un dash suffit à sortir de l'arène depuis n'importe où

Mesuré en écrivant les tests réseau : un dash suivi de son roulement libre couvre **~316 unités**
(`dashSpeed 700`, puis `deceleration 300` sous `maxSpeed` — ce n'est pas `overspeedDeceleration`
qui s'applique à la queue). Le rayon de l'arène est de 330. Depuis n'importe quel point de spawn,
un dash dirigé vers le bord est donc mortel, sans qu'aucun adversaire n'intervienne.

C'est peut-être le jeu voulu — un dash qui engage vraiment. Mais ce n'est écrit nulle part, et ça
rend le dash inutilisable comme outil de déplacement : il ne sert qu'à percuter.

**Accroche :** les sept nombres sont groupés dans `PLAYER_MOVEMENT`
(`apps/bump-royal/src/game/sim/prefabs/buildPlayerSim.ts`), et le modèle est décrit en
[[velocity-ownership]] §13. La distance de queue est `v²/(2·deceleration)`, donc calculable avant
de toucher au jeu.
