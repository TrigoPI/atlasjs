---
id: APP-24
status: todo
domain: app
effort: S
verified: 2026-09-01
---

# `apps/bump-royal` n'a aucune infrastructure de test

Pas de dossier `test/`, pas de script `test` dans `apps/bump-royal/package.json` (ses scripts sont `dev`, `build`, `lint`, `typecheck`, `preview`), donc l'app est invisible pour `pnpm test` — turbo ne trouve rien à lancer. `apps/dino-brawl` est le gabarit : `"test": "vitest run"`, un dossier `test/` qui mime l'arborescence de `src/`, et un `tsconfig.test.json` référencé depuis son `tsconfig.json`.

La conséquence est précise, pas générique. La **règle de gameplay** du modèle de mouvement — calculer la cible puis **choisir le taux par comparaison de magnitudes**, dans `onFixedUpdate` de `apps/bump-royal/src/game/script/player/PlayerMovementScript.ts` (fichier en cours de retouche, d'où l'absence de numéros de ligne) — est la partie qui porte une opinion, et c'est celle que **rien** ne couvre. La primitive en dessous est couverte, elle, dans `packages/math/test/vec2-move-towards.test.ts` ; le navigateur n'a prouvé la glisse que **qualitativement**, et à 4 fps (voir [[velocity-ownership]] §11).

**Accroche :** recopier le setup vitest de dino-brawl (script `test`, `vitest.config.ts`, `tsconfig.test.json`) ; la première spec qui vaut d'être écrite est **la sélection du taux après un bump** — vélocité au-delà de `maxSpeed`, input tenu dans le sens du knockback, et l'assertion que c'est `deceleration` qui est retenue. C'est la branche qu'aucune session navigateur ne peut atteindre aujourd'hui, la scène ne contenant qu'un seul corps.

**À rapprocher de :** [[GAMEPLAY-112-script-harness-cannot-drive-fixed-lane]] — le même trou vu depuis le moteur : même avec vitest en place ici, le seam unitaire publié ne sait pas déclencher `onFixedUpdate`.
