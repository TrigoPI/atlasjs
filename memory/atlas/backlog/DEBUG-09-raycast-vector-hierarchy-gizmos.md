---
id: DEBUG-09
status: todo
domain: debug
source: "[[gizmos]]"
effort: M
verified: 2026-09-04
---

# Gizmos de raycast, de vecteurs et de hiérarchie

`Gizmos.drawLine` est livré (`DEBUG-02`), mais rien dans le moteur ne s'en sert : les trois usages qui le justifiaient restent à écrire — visualiser un raycast (origine, direction, point d'impact, normale), un vecteur porté par une entité (direction, vitesse, normale de contact), et les liens parent → enfant d'une hiérarchie.

**Accroche :** `Gizmos.drawLine` + le pool de `LineNode` (`packages/gizmos/src/Gizmos.ts`), et les deux systèmes v1 (`ColliderGizmoSystem`, `PivotGizmoSystem`) donnent le patron d'un producteur en `PreRender` `before: "gizmos:flush"`. Le seul consommateur existant vit côté app (`ArenaBoundsGizmoScript` dans `apps/bump-royal`).
