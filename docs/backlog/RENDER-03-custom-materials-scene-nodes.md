---
id: RENDER-03
legacyId: A4
status: todo
domain: rendering
source: "[[renderer-architecture]]"
effort: M
verified: 2026-08-19
---

# Custom materials sur scene nodes

`SpriteNode` n'expose aucun champ `material` (seulement `texture`, `sampler`, `tint`, `blend`) : le chemin instancié (`SpriteBatch`/`ShapeBatch`) reste séparé du chemin générique `Material`/`draw(geometry, material, bindings)`. Il faut brancher les nœuds de scène sur le chemin `Material` pour permettre des effets custom.

**Accroche :** le chemin générique `draw(geometry, material, bindings)` de `packages/nebula/src/core/renderer/Renderer.ts` existe déjà, indépendamment du chemin instancié des sprites/shapes.

**À rapprocher de :** l'item « Branchement `Sprite.material` » du lot Shaders & Materials.
