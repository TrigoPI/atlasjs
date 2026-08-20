---
id: GAMEPLAY-16
legacyId: C1
status: vision
domain: gameplay
source: "[[camera]]"
effort: L
verified: 2026-08-19
---

# Rendu simultané multi-caméras

`SceneRenderer.render()` (`packages/nebula/src/renderers/SceneRenderer.ts:39-50`) lit `getCameraViewport()` une seule fois pour une seule passe, et `CameraManager` ne connaît qu'une entité `active`. Split-screen, minimap ou render-to-texture par caméra demandent une `RenderPass` par caméra avec des viewport rects distincts — refonte entière du chemin de rendu, encore à concevoir.

**Accroche :** `CameraManager` est déjà le seam d'autorité à étendre vers plusieurs caméras actives.
