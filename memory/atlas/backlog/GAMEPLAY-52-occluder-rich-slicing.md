---
id: GAMEPLAY-52
status: todo
domain: gameplay
source: "[[occluder-ysort]]"
effort: M
verified: 2026-08-20
---

# Slicing riche des occluders (perCol, diagonale, per-cell, ancrage par tuile)

`bakeOccluderStrips` ne supporte que `slice: "single"` et `"perRow"`. Les structures qui reculent selon un autre axe que nord-sud (diagonale, `perCol`), un découpage par cellule, ou un anchor/foot configurable tuile par tuile restent à ajouter au baker.

**Accroche :** `bakeOccluderStrips` (`packages/gameplay/src/systems/utils/bake-occluder-strips.ts`) donne déjà la structure `OccluderRegion`/`slice` à étendre avec de nouveaux modes.
