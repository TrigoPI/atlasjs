---
id: PHYSICS-27
status: todo
domain: physics
effort: S
verified: 2026-09-06
---

# `ensureRapierInit` rejoue `RAPIER.init()` à chaque appel

`packages/rapier/src/ensure-rapier-init.ts` déclare un `RAPIER_INSTANCE` qui n'est **jamais
assigné**. La garde de mémoïsation est donc morte : rolldown supprime le `if` à la compilation et
chaque appel relance `RAPIER.init()` (~64 ms mesurés sous Node).

**Accroche :** inoffensif tant qu'il n'existe qu'un seul monde physique par process, ce qui est le
cas partout aujourd'hui — mais un serveur multi-parties en ferait plusieurs, et c'est précisément
la direction que prend [[state-sync]].
