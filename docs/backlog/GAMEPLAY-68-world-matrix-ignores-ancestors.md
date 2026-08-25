---
id: GAMEPLAY-68
status: todo
domain: gameplay
source: "[[entity-hierarchy]]"
effort: M
verified: 2026-08-25
---

# `worldMatrix` retombe silencieusement sur la matrice locale et ignore la chaîne d'ancêtres

`packages/gameplay/src/scripting/components/Transform.ts:32-41` : si `WorldTransform2D` est absent, le repli est `Mat3.fromTransform2D(local)`. Or `WorldTransform2D` n'est créé que par `TransformPropagationSystem.ensureWorldTransforms` (`src/systems/TransformPropagationSystem.ts:31-39`) au stage `Late`. Toute entité créée pendant la frame N — typiquement `this.instantiate(prefab)` dans un `onUpdate`, qui tourne au stage `Logic` — n'en a pas. Si elle est parentée, `worldPosition` (`Transform.ts:82-84`) ignore tous ses ancêtres, sans erreur : un enfant en local `(0,0)` rapporte `(0,0)`.

Le même repli fausse `setParent(parent, worldPositionStays=true)` (`Transform.ts:152-162`), qui recalcule un local aberrant à partir de deux matrices dont l'une au moins peut être purement locale. S'ajoute une péremption d'une frame dans le cas nominal — le cache est écrit au `Late` et relu par les scripts au `Logic` suivant — avec impact réel sur `apps/dino-brawl/src/game/scripts/weapon/SwordScript.ts:244`. Le cas « `WorldTransform2D` absent » n'est testé nulle part : `packages/gameplay/test/transform-parent-facade.test.ts:29-49` le peuple à la main (`:36`, `:40`).

**Accroche :** la branche de repli de `Transform.ts:38-40`. Y remonter la chaîne via `world.getParent` et composer les matrices locales. Bonus au même endroit : `wt.matrix.clone()` (`:39`) alloue une `Mat3` à chaque lecture de `worldPosition`, alors que seul `setParent` a besoin d'une copie mutable.
