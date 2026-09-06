---
id: APP-27
status: todo
domain: app
effort: S
verified: 2026-09-06
---

# `apps/dino-brawl` importe par un alias que Vite ne connaît pas

`src/game/scripts/enemy/SpawnEnemyScript.ts:7` importe via `@dino-brawl/game/prefabs`. L'alias
est déclaré dans `tsconfig.app.json` `paths` mais **absent** de `resolve.alias` du
`vite.config.ts`. Ça ne casse pas aujourd'hui uniquement parce que c'est un `import type`, effacé
par `verbatimModuleSyntax` avant que le résolveur de Vite ne voie le specifier. Le premier import
de *valeur* par ce chemin type-checkera proprement puis explosera dans le navigateur.

**Accroche :** `apps/bump-royal` avait exactement le même piège et l'a réglé en supprimant l'alias
au profit d'imports relatifs — c'est ce que font déjà les 31 fichiers de test de dino-brawl, dont
aucun n'utilise `@dino-brawl/*`.
