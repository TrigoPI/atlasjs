---
id: RENDER-18
status: todo
domain: rendering
source: "[[trails]]"
effort: M
verified: 2026-08-23
---

# Courbes de largeur et gradients multi-clés sur les trails

`TrailNode` interpole linéairement `startWidth`→`endWidth` et `startColor`→`endColor`. Unity offre des courbes complètes et des gradients à plusieurs clés, ce qui permet par exemple un ruban qui s'épaissit au milieu ou change deux fois de teinte.

**Accroche :** `computeEdgesAndColors` dans `packages/nebula/src/renderers/TrailNodeRenderer.ts` calcule déjà un paramètre `t` par point — c'est le seul point d'entrée à généraliser.
