---
id: RENDER-23
status: todo
domain: rendering
source: "[[trails]]"
effort: M
verified: 2026-08-23
---

# Lisser les trails par tessellation de spline

`TrailRenderSystem` échantillonne la position de l'émetteur **une fois par frame**, et `TrailNodeRenderer` relie ces points par des cordes droites. Dès que la pointe va vite, l'écart angulaire entre deux échantillons devient visible : un swing de rappier à `time: 0.14` sur 60 fps donne ~9 points, et le ruban se lit comme un ennéagone au lieu d'un cercle.

Aucun réglage ne le corrige : `minVertexDistance` ne fait que *filtrer* des points déjà émis, il n'en crée jamais, et monter `time` allonge le ruban sans le densifier. Le correctif est de tesseller une Catmull-Rom centripète (`alpha = 0.5`, qui évite les cusps et les auto-intersections sur un échantillonnage irrégulier) à travers les points existants, avec K sous-segments par paire source. Le lissage devient alors indépendant du framerate.

**Accroche :** la densification s'insère entre `readPositions` et `computeNormals` dans `packages/nebula/src/renderers/TrailNodeRenderer.ts` — la math miter, le partage de bord et l'invariant d'étanchéité travaillent ensuite sur la polyligne densifiée sans changer d'une ligne. Le paramètre d'interpolation largeur/couleur doit rester celui de la **source** (`t = (i + f) / (count - 1)`) pour que le dégradé ne se déforme pas.
