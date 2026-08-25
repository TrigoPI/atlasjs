---
id: GAMEPLAY-71
status: todo
domain: gameplay
source: "[[occluder-ysort]]"
effort: S
verified: 2026-08-25
---

# Contrat incohérent d'`OccluderStrip` entre champs relus et champs figés

`packages/gameplay/src/systems/OccluderRenderSystem.ts:45-51` relit `strip.sortingLayer` et `strip.footY` à chaque frame, tandis que `strip.texture` et `strip.tiles` ne sont lus qu'au montage, dans `resolveNode` (`:67-77`). Les quatre sont pourtant `public` et mutables (`src/components/OccluderStrip.ts:4-7`) : réaffecter `strip.tiles` après le premier passage est un no-op silencieux, alors que réaffecter `strip.footY` marche.

Le fond — les occluders sont statiques — est une décision assumée ; c'est l'**incohérence de surface** qui mérite d'être levée, parce que rien dans le type ne distingue les deux moitiés.

**Accroche :** passer `texture` et `tiles` en `readonly` sur `OccluderStrip.ts:5-6`, pour que le compilateur dise ce que le système fait réellement.

**À rapprocher de :** [[GAMEPLAY-54-dynamic-occluders]] — c'est la feature qui lèverait le fond ; cette note ne traite que la cohérence de la surface.
