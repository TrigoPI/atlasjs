---
id: RENDER-08
status: todo
domain: rendering
source: "[[shapes]]"
effort: S
verified: 2026-08-19
---

# Coins arrondis / feather sur les shapes

`params.z`/`params.w` ne sont lus nulle part dans `shape_instanced.wgsl` (seuls `params.x`/`params.y` sont utilisés) : le slot est libre pour porter un rayon de coin arrondi et/ou un feather, à combiner avec la distance SDF déjà calculée.

**Accroche :** `rectDist` dans `packages/nebula-webgpu/src/shaders/shape_instanced.wgsl` calcule déjà la distance SDF de base ; les canaux `params.z`/`params.w` sont libres pour y brancher un rayon de coin.
