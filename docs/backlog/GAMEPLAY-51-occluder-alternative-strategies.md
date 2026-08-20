---
id: GAMEPLAY-51
status: vision
domain: gameplay
source: "[[occluder-ysort]]"
effort: L
verified: 2026-08-20
---

# Approches alternatives pour les occluders (flyweight zéro-entité, détection automatique)

Deux stratégies alternatives au backend actuel (une entité `OccluderStrip` par strip, baker piloté par un rectangle `occluder_regions`) restent non implémentées : un backend « flyweight zéro-entité » qui pousserait directement des sort keys dans le `RenderQueue` sans entité ECS, à envisager seulement si le profiler réclame une échelle de plusieurs milliers d'occluders ; et une détection automatique par composantes connexes du calque `occluders` (sans rectangle d'intention), mode de secours moins précis pour les structures nord-sud ou les arbres.
