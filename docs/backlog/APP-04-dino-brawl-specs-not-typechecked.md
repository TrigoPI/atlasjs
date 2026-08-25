---
id: APP-04
status: todo
domain: app
effort: S
verified: 2026-08-24
---

# Les specs de `apps/dino-brawl` ne sont jamais type-checkées

`tsconfig.app.json` déclare `include: ["src"]` et `tsconfig.node.json` se limite à `vite.config.ts` : aucune configuration ne couvre `test/`. Les 18 fichiers de spec passent donc par eslint et par l'effacement de types de vitest, mais jamais par le compilateur — un renommage dans `src/` peut casser le typage d'une spec sans aucun signal, seul l'échec du test le révélerait. Reste à ajouter une configuration qui couvre `test/`.

**Correction du 2026-08-24 : les specs ne compilent PAS proprement.** L'accroche précédente affirmait le contraire « vérifié le 2026-08-21 » — c'est faux. Type-checker `test/` avec les flags de `tsconfig.app.json` sort deux erreurs, la même dans les deux cas : `RecordingHurtbox` étend `HurtboxScript` en redéclarant `lastKnockback`, qui est `private` sur la base (`meleeHitResolver.test.ts:20` et `swordScript.test.ts:16`, TS2415). Vérifié sur `dev` : le champ était déjà `private` et ces deux fichiers n'ont pas bougé depuis, donc la dette est antérieure.

**Accroche :** ajouter la configuration qui couvre `test/` reste petit, mais ce n'est plus une opération sans conséquence — il faut aussi régler ces deux extensions de classe, sans quoi la nouvelle config sort rouge dès son premier passage. Les deux se règlent au même endroit : exposer ce dont les faux hurtbox ont besoin, ou les composer au lieu de les dériver.
