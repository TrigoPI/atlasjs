---
id: DEBUG-06
status: todo
domain: debug
source: "[[gizmos]]"
effort: S
verified: 2026-08-19
---

# Contour de sprite / marqueur du sort point

`SpriteRender.sortPointEntity` existe et est déjà exploité par `SpriteRenderSystem`, mais aucun `SpriteGizmo` n'existe côté `@atlasjs/gizmos` pour visualiser le rect du sprite rendu ou la position de ce point de tri.

**Accroche :** `ColliderGizmo`/`PivotGizmo` (`packages/gizmos/src/components/`) donnent déjà le patron de composant gizmo à répliquer.
