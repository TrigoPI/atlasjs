---
id: GAMEPLAY-12
legacyId: H4
status: todo
domain: gameplay
source: "[[entity-hierarchy]]"
effort: S
verified: 2026-08-19
---

# Composition de transform pour les bodies dynamic

`TransformPropagationSystem.ts:59-63` court-circuite toujours la composition parent pour un body dynamic (`if (parentWorld === null || isDynamic) wt.matrix.copy(this.localScratch)`), l'autorité physique écrasant le parenting. Il reste à recalculer local = monde − parent pour composer proprement un dynamic avec son parent au lieu de l'ignorer.
