---
id: GAMEPLAY-47
status: partial
domain: gameplay
source: "[[tilemap]]"
effort: M
verified: 2026-08-19
---

# Optimisations de rendu tilemap (buffer persistant + chunking)

Le rebuild CPU des instances est déjà gaté par `(revision, plage-visible)` et réutilise les `TileInstance`/`Vec4` en place, sans allocation en régime permanent — cette partie est faite. Ce qui reste : `TileMapNodeRenderer.updateInstances` recalcule tous les `Mat4`/`uvRects` à chaque frame et réuploade le batch à chaque frame, faute de buffer d'instances persistant et de chunking/culling par chunk.

**Accroche :** `TileMapRenderSystem.ts:147-158` (`packages/gameplay/src/rendering/TileMapRenderSystem.ts`) est la partie déjà faite, à ne pas refaire ; `TileMapNodeRenderer.updateInstances` (`packages/nebula/src/renderers/TileMapNodeRenderer.ts:86-112`) est ce qui reste à optimiser.
