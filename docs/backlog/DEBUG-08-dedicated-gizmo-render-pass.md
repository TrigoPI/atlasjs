---
id: DEBUG-08
status: vision
domain: debug
source: "[[gizmos]]"
effort: M
verified: 2026-08-19
---

# Passe de rendu gizmo dédiée (overlay hors scene-graph)

Les nœuds gizmo sont aujourd'hui ajoutés à `nebula.scene` avec `sortingLayer = GIZMO_SORTING_LAYER` (1 000 000) plutôt que dessinés dans une passe séparée après la scène. Conceptuellement plus juste — les gizmos ne sont pas du contenu de scène — mais sans effet visuel différent aujourd'hui.

**Accroche :** `NodeRing.ts:20-22` (`packages/gizmos/src/NodeRing.ts`) est l'endroit où les nœuds sont actuellement injectés dans le scene-graph.
