---
id: DEBUG-03
status: todo
domain: debug
source: "[[gizmos]]"
effort: M
verified: 2026-08-19
---

# Formes exactes capsule / segment / polygon

`ColliderGizmoSystem` ne sait dessiner que les shapes `box`/`circle` : tout autre type déclenche un `warnOnce` puis ne dessine rien. Reste à ajouter une capsule (3ᵉ `shapeKind` SDF) et segment/polygon (boucle de `LineNode`, une fois `drawLine` disponible).

**Accroche :** `ColliderGizmoSystem.ts:44-47` (`packages/gizmos/src/systems/ColliderGizmoSystem.ts`) localise déjà exactement où brancher les nouveaux types.
