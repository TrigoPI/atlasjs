---
id: GAMEPLAY-10
legacyId: H2
status: todo
domain: gameplay
source: "[[entity-hierarchy]]"
effort: M
verified: 2026-08-19
---

# Rendu exact du shear

`SpriteRenderSystem` (`packages/gameplay/src/systems/SpriteRenderSystem.ts:57-59`) décompose `WorldTransform2D.matrix` en position/rotation/scale (TRS) avant de les répercuter côté nebula, ce qui est lossy dès qu'un parent porte une échelle non uniforme sous une rotation imbriquée. Il reste à ouvrir un seam matrice-monde sur `Transformable` (nebula) — aucun `setLocalMatrix`/`setMatrix` n'existe aujourd'hui — pour court-circuiter cette décomposition.
