---
id: CORE-09
status: todo
domain: core
effort: S
verified: 2026-09-01
---

# Les specs de `packages/math` ne sont jamais type-checkées

`packages/math/tsconfig.json` est `{ "extends": "../../tsconfig.base.json", "include": ["src"] }` :
le dossier `test/` est **hors périmètre**. Et vitest ne comble pas le trou — il transpile les specs
via esbuild, qui **efface** les types sans les vérifier. Une spec de ce package peut donc contenir
une erreur de type et passer au vert indéfiniment.

**Correction de la description initiale du trou** — le mécanisme de référence n'est pas celui qu'on
croyait, et il n'est pas le même dans les deux endroits cités :

- `packages/gameplay` n'a **pas** de référence de projet vers son `tsconfig.test.json` : son
  `tsconfig.json` est mot pour mot le même que celui de `math` (`include: ["src"]`). Ce qui ferme le
  trou là-bas est un **script de package** : `"typecheck": "tsc --noEmit -p tsconfig.test.json"`,
  et le `tsconfig.test.json` étend le `tsconfig.json` en ajoutant `include: ["src", "test"]`.
- `apps/dino-brawl`, lui, utilise bien la **référence de projet** : son `tsconfig.json` est un
  `files: []` + `references` vers `tsconfig.app.json`, `tsconfig.node.json` et `tsconfig.test.json`,
  et son `typecheck` est `tsc -b`. Deux mécanismes différents pour le même besoin.

Et le trou est plus large que `math` : **seuls 4 packages sur 14 ont un script `typecheck`**
(`audio`, `gameplay`, `gizmos`, `utils`). Les 10 autres n'en ont aucun, et 9 d'entre eux ont pourtant
un dossier `test/` — `assets`, `core`, `inertia`, `input`, `math`, `nebula`, `nebula-webgpu`,
`nexus`, `rapier` (seul `debug` n'a pas de specs). Ajouter un `tsconfig.test.json` à `math` sans
ajouter le script ne changerait donc rien.

Pire, l'agrégat racine ne rattrape pas l'affaire : `package.json` racine déclare
`"check-types": "turbo run check-types"`, or **aucun** package ni app ne définit de script
`check-types` (ils s'appellent `typecheck`), et `turbo.json` ne déclare que les tâches `build`,
`dev`, `test` et `clean`. La commande racine ne vérifie donc rien.

**Accroche :** recopier `packages/gameplay/tsconfig.test.json` (3 lignes) **et** son script
`typecheck` dans `packages/math`, puis décider si l'on aligne le nom de la tâche (`typecheck` vs
`check-types`) et si on la déclare dans `turbo.json` — sinon la correction reste locale et le trou
se rouvre dans le package suivant. Le trou a été trouvé en ajoutant `Vec2.moveTowards`
([[velocity-ownership]] §7), dont les specs assertent l'**égalité flottante exacte** — précisément
le genre de code où une erreur de type se cache bien.
