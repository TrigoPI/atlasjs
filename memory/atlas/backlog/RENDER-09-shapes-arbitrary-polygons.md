---
id: RENDER-09
status: vision
domain: rendering
source: "[[shapes]]"
effort: L
verified: 2026-08-19
---

# Polygones arbitraires

Aucun symbole `Polygon` n'existe dans `packages/nebula*/src`. Le chemin actuel (`shape_instanced.wgsl`) ne connaît que rect/cercle sur un quad instancié uniforme : des polygones arbitraires demanderaient un modèle de géométrie différent, hors du chemin instancié existant.
