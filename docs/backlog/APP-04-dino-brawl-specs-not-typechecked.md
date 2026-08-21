---
id: APP-04
status: todo
domain: app
effort: S
verified: 2026-08-21
---

# Les specs de `apps/dino-brawl` ne sont jamais type-checkées

`tsconfig.app.json` déclare `include: ["src"]` et `tsconfig.node.json` se limite à `vite.config.ts` : aucune configuration ne couvre `test/`. Les 18 fichiers de spec passent donc par eslint et par l'effacement de types de vitest, mais jamais par le compilateur — un renommage dans `src/` peut casser le typage d'une spec sans aucun signal, seul l'échec du test le révélerait. Reste à ajouter une configuration qui couvre `test/`.

**Accroche :** les specs compilent déjà proprement avec les flags de `tsconfig.app.json` (vérifié le 2026-08-21), la dette est dans la couverture des configs, pas dans les fichiers.
