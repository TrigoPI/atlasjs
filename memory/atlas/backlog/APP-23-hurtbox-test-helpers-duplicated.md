---
id: APP-23
status: todo
domain: app
effort: S
verified: 2026-08-27
---

# `createHurtbox` et `createInvincibleHurtbox` sont recopiés à l'identique dans deux specs

La paire existe deux fois, mot pour mot : `apps/dino-brawl/test/game/scripts/combat/meleeHitResolver.test.ts:73-77` et `apps/dino-brawl/test/game/scripts/weapon/swordScript.test.ts:129-133`. Une troisième variante, de forme différente, vit dans `hurtboxScript.test.ts:33`.

La duplication a un coût déjà payé : quand `HurtboxScript` est passé à un `countdown` et que `onCreate` est devenu obligatoire, il a fallu corriger les deux copies séparément, et la seconde n'était pas dans le périmètre annoncé de la tâche — elle a été trouvée en lançant la suite, pas en lisant le plan.

**Accroche :** même grief et même forme de correction que [[APP-11-player-spec-fakes-duplicated]] : un dossier `helpers/` local aux specs, sans rien exposer depuis `src/`. Les deux notes gagneraient à être traitées ensemble — c'est le même geste, sur deux familles de specs.
