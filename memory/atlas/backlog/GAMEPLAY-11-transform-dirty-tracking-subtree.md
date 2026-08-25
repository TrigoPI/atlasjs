---
id: GAMEPLAY-11
legacyId: H3
status: todo
domain: gameplay
source: "[[entity-hierarchy]]"
effort: M
verified: 2026-08-19
---

# Dirty-tracking par sous-arbre pour la propagation de transform

`TransformPropagationSystem.update()` reparcourt toute la forêt de hiérarchie à chaque frame, sans flag dirty. Il reste à introduire un dirty-tracking par sous-arbre pour éviter ce recalcul intégral.

**Accroche :** `Node` (nebula, `packages/nebula/src/graphics/Node.ts:100-123`) porte déjà ce patron (`localDirty`/`changed` propagés) à reproduire côté Nexus.
