---
id: RENDER-01
legacyId: A2
status: vision
domain: rendering
source: "[[renderer-architecture]]"
effort: L
verified: 2026-08-19
---

# Text rendering

Aucun rendu de texte n'existe dans le moteur : pas de chargement de police, pas d'atlas de glyphes, pas de composant texte. Tout est à construire, du format de police jusqu'au nœud de scène.

**Accroche :** le seam `NodeRenderer`/`Batcher` (`packages/nebula/src/renderers/NodeRenderer.ts`, `Batchers.ts`) est déjà prêt à accueillir un nouveau type de batcher, sur le modèle de `SpriteBatcher`/`ShapeBatcher`.
