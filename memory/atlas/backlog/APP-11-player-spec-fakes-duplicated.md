---
id: APP-11
status: todo
domain: app
source: "[[afterimages]]"
effort: S
verified: 2026-08-24
---

# Les fakes des specs joueur sont recopiés trois fois

`FakeVector2Action`, `FakeButtonAction`, `FakePlayerInput`, `FakeContext` et `FakeDash` existent en trois exemplaires identiques, dans `playerDashScript.test.ts`, `playerMovementScript.test.ts` et `playerAnimationScript.test.ts` — une bonne centaine de lignes dupliquées. Un changement de la façade de script se répercutera à trois endroits, et rien ne signalera celui qu'on oublie.

**Accroche :** dette assumée, pas un oubli — la contrainte « pas de nouvelle abstraction partagée » du chantier du dash l'imposait tâche par tâche. Le regroupement se fait maintenant que les trois fichiers existent et sont verts : un `test/game/scripts/player/helpers/` local aux specs joueur, sans rien exposer depuis `src/`. Au passage, `FakeDash.dashDirection` dans `playerMovementScript.test.ts` est de la surface morte — le script de mouvement ne lit jamais la direction.
