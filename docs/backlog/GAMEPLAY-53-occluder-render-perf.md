---
id: GAMEPLAY-53
status: todo
domain: gameplay
source: "[[occluder-ysort]]"
effort: M
verified: 2026-08-20
---

# Optimisations de rendu des occluders (culling par strip, atlas/texture-array partagé)

`OccluderRenderSystem` soumet tous les strips chaque frame sans AABB-cull contre le viewport ; et chaque tileset d'occluder (arbres, murs…) garde son propre `batchKey`, donc son propre run de draw — pas d'atlas ou de texture-array partagé pour les fusionner. Les deux réduiraient les draw calls, différées faute de besoin à l'échelle actuelle (quelques dizaines de strips).
