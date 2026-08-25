---
id: GAMEPLAY-22
legacyId: C7
status: todo
domain: gameplay
source: "[[camera]]"
effort: L
verified: 2026-08-19
---

# Scroll sous-pixel fluide + pixels nets (render target basse résolution)

`Camera2D.pixelSnap` ne fait qu'un snap par pas d'1px sur la translation ; aucun chemin de rendu bas-résolution + upscale avec offset sous-pixel au blit (façon Celeste) n'existe dans `packages/nebula/src/renderers/` ni `core/renderer/RenderTarget.ts`. Reste à bâtir ce second étage pour obtenir fluidité et netteté simultanées.

**Accroche :** `Camera2D.pixelSnap` et l'infrastructure render-to-texture (`memory/atlas/rendering/renderer-architecture.md` §7) sont déjà en place à réutiliser.
