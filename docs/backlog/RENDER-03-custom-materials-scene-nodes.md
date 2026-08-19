---
id: RENDER-03
legacyId: A4
status: todo
domain: rendering
source: "[[renderer-architecture]]"
effort: M
verified: 2026-08-19
---

# Custom materials sur scene nodes et sur les sprites

`SpriteNode` n'expose aucun champ `material` (seulement `texture`, `sampler`, `tint`, `blend`) : le chemin instancié (`SpriteBatch`/`ShapeBatch`) reste séparé du chemin générique `Material`/`draw(geometry, material, bindings)`. C'est la même lacune vue sous deux angles : côté scene node, il manque un point d'attache générique pour un `Material` ; côté sprite, c'est ce qui bloquerait des effets custom appliqués directement sur un sprite (`Sprite.material`). Il faut brancher les nœuds de scène — sprites compris — sur le chemin `Material`, et unifier à terme le chemin instancié avec le chemin générique.

**Accroche :** le chemin générique `draw(geometry, material, bindings)` de `packages/nebula/src/core/renderer/Renderer.ts` existe déjà, indépendamment du chemin instancié des sprites/shapes.
