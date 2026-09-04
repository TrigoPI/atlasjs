---
id: RENDER-30
status: todo
domain: rendering
source: "[[particles]]"
effort: S
verified: 2026-09-04
---

# Clé de batch construite en chaîne à chaque frame

Les node renderers qui batchent par matériau construisent leur clé en template string **depuis `collect`**, donc une chaîne allouée par nœud par frame : `` `${texture.id}|${sampler.id}|${blend}` `` en ligne dans `TileMapNodeRenderer.ts:55` et `CPUParticleNodeRenderer.ts:66`, et via le helper privé `createMaterialKey` dans `SpriteRenderer.ts:124-130`, appelé depuis `collect` (ligne 65). `ShapeRenderer` et `TrailNodeRenderer` n'utilisent pas `getBatchId` et ne sont donc pas concernés. Comportement préexistant côté sprites et tilemaps, hérité tel quel par le renderer de particules, et plus visible là parce qu'un émetteur vaut un effet — là où les sprites amortissent la chaîne sur des centaines de nœuds partageant la même clé.

**Accroche :** `getBatchId` mémoïse déjà l'association clé → id dans une `Map` (`packages/nebula/src/renderers/CPUParticleNodeRenderer.ts:216-227`, dupliqué à l'identique dans les deux autres) ; seule la construction de la clé alloue. Deux `Map` imbriquées sur `(texture.id, sampler.id, blend)`, ou un entier composite, suppriment l'allocation sans toucher au reste du batching.

**À rapprocher de :** [[RENDER-20-shared-blend-batch-ids]], qui touche aux mêmes tables de batching.
