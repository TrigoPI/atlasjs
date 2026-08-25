---
id: GAMEPLAY-47
status: partial
domain: gameplay
source: "[[tilemap]]"
effort: M
verified: 2026-08-25
---

# Optimisations de rendu tilemap (buffer persistant + chunking)

Le rebuild CPU des instances est déjà gaté par `(revision, plage-visible)` et réutilise les `TileInstance`/`Vec4` en place, sans allocation **dans la boucle d'instances** — cette partie-là est faite. Ce qui reste : `TileMapNodeRenderer.updateInstances` recalcule tous les `Mat4`/`uvRects` à chaque frame et réuploade le batch à chaque frame, faute de buffer d'instances persistant et de chunking/culling par chunk.

**Correction du 2026-08-25 : « sans allocation en régime permanent » était faux tel qu'écrit.** L'affirmation vaut pour la boucle d'instances, pas pour le préambule de `rebuildInstances`, qui calcule tout **avant** de tester la porte de rebuild. Par frame et par calque, `packages/gameplay/src/systems/TileMapRenderSystem.ts:138-145` alloue 1 `Bound` (`getCameraViewport` retourne un `Bound.create(...)`), 1 `Mat3` et son `Float32Array` (`matrix.clone()`), 1 `Bound` de sortie et 1 littéral `CellRange`. Avec 4 calques à 60 fps, ≈ 2000 objets/s de pression GC en régime permanent, caméra immobile et porte de rebuild fermée. Laissée telle quelle, la phrase d'origine détournerait un futur profilage.

Correctif du préambule : trois champs scratch sur le système (`invWorldScratch`, `localViewportScratch`, `rangeScratch`), `invWorldScratch.copy(worldTransform.matrix).invert()` au lieu de `.clone().invert()`, et des signatures `worldBoundToLocalBound(inv, bound, out)` / `visibleCellRange(cellSize, cellGap, local, out)` qui écrivent dans le scratch au lieu de retourner du neuf. **Rien n'a été mesuré au profileur** : le décompte ci-dessus est statique, il dit ce qui est alloué, pas ce que ça coûte.

**Accroche :** `TileMapRenderSystem.ts:147-158` (`packages/gameplay/src/systems/TileMapRenderSystem.ts`) est la porte de rebuild déjà faite, à ne pas refaire ; `TileMapNodeRenderer.updateInstances` (`packages/nebula/src/renderers/TileMapNodeRenderer.ts:86-112`) est ce qui reste à optimiser.

**Mise à jour du 2026-08-25 : CORE-07 est réglé, il en reste 4.** `Mat3.transformBound` existe désormais dans `@atlasjs/math` et `worldBoundToLocalBound` n'alloue plus — les 4 `Vec2` que produisait `Mat3.transformPoint2`, un par coin, ont disparu du préambule. Restent les quatre objets listés ci-dessus, tous justiciables du même geste : hisser un champ scratch sur le système. Le plus coûteux à traiter est le `Bound` de `getCameraViewport`, parce qu'il impose de faire prendre un `out` à l'interface `Renderer` de nebula — changement d'API inter-paquets, à ne pas glisser en passant.

À noter que ce décompte est un **plancher** : `Mat3.clone()` produit en réalité trois objets (le littéral de tableau, le `Float32Array`, l'instance), là où cette note en comptait deux. Argument de plus pour le `copy()` plutôt que le `clone()`.
