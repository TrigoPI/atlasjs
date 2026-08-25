---
id: GAMEPLAY-75
status: todo
domain: gameplay
effort: M
verified: 2026-08-25
---

# Duplication du triplet transform→nœud→sort fields entre les systèmes de rendu

Le même bloc de ~6 lignes (`worldTransform.getPosition(scratch)` → `getRotation()` → `getScale(scratch)` → `node.setPosition/setRotation/setScale` → `applySortFields`) est écrit trois fois à l'identique : `packages/gameplay/src/systems/SpriteRenderSystem.ts:48-61` (son `applySortFields` est décalé en `:77-83`, après le calcul du `sortPoint`), `TileMapRenderSystem.ts:105-120` et `OccluderRenderSystem.ts:36-51`. Et la structure de pool `detach → detached.push → balayage swap-pop → clear` est recopiée mot pour mot deux fois : `TrailRenderSystem.ts:75-107` et `AfterimageRenderSystem.ts:105-139`. Le risque n'est pas cosmétique : les cinq systèmes de rendu passent chacun leur propre `worldY` à `applySortFields` (`src/rendering/applySortFields.ts:9-27`), donc rendre l'axe de tri configurable demandera **5 modifications coordonnées, dont aucune n'est protégée par un test** qui casserait si l'une était oubliée.

Correctif en deux extractions minimales, sans nouvelle couche : `src/rendering/syncNodeTransform.ts` (fonction pure retournant la position, utile pour le `sortY` ; `SpriteRenderSystem` applique ensuite son flip, `AfterimageRenderSystem` le fige dans son slot) et `src/rendering/DetachedPool.ts` (`push`/`sweep`/`clear`). **Ne pas aller plus loin** : pas de classe de base `RenderSystem` — les 5 systèmes divergent trop côté montage (`SparseSet` pour sprite/trail/afterimage, `Map` pour tilemap/occluder ; 1 nœud pour les uns, N pour l'afterimage) pour qu'un héritage soit rentable.

**Accroche :** comparer `SpriteRenderSystem.ts:48-61` et `OccluderRenderSystem.ts:36-51` côte à côte — c'est la paire la plus proche, et la plus simple à extraire en premier.

**À rapprocher de :** [[GAMEPLAY-58-sort-axis-configurable]] — cette extraction en est le prérequis pratique.
