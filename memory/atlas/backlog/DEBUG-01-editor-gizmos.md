---
id: DEBUG-01
status: todo
domain: debug
source: "[[gizmos]]"
effort: M
verified: 2026-08-19
---

# Gizmos d'éditeur (poignées, contour, preview collider)

Il reste à écrire des poignées de sélection/déplacement/échelle, un contour d'entité sélectionnée, et une preview de collider en édition — aucun producteur n'existe encore pour ces gizmos.

**Accroche :** le seam est déjà prêt et réel : `GizmoPlugin` (`packages/gizmos/src/GizmoPlugin.ts:53,63,73`) expose `before: "gizmos:flush"`, où tout producteur s'insère sans toucher à `@atlasjs/gizmos`. Il n'y a rien à concevoir, seulement un consommateur à écrire. (L'ancien `packages/editor` a été supprimé du dépôt ; il n'y a plus de package éditeur aujourd'hui.)
