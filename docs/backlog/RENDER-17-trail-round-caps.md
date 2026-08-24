---
id: RENDER-17
status: todo
domain: rendering
source: "[[trails]]"
effort: S
verified: 2026-08-23
---

# Caps ronds sur les extrémités de trail

Les deux bouts du ruban sont coupés net : le feather `fwidth` de `trail.wgsl` ne porte que sur les bords longs, pas sur les extrémités. Un cap arrondi adoucirait la tête et la queue.

**Accroche :** `fs_main` dans `packages/nebula-webgpu/src/shaders/trail.wgsl` calcule déjà une couverture depuis `side` ; il manque une coordonnée le long du segment pour appliquer le même traitement aux extrémités.
