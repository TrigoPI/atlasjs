---
id: GAMEPLAY-79
status: todo
domain: gameplay
source: "[[tilemap]]"
effort: S
verified: 2026-08-25
---

# La clé de rebuild tilemap ignore le pas de grille

`packages/gameplay/src/systems/TileMapRenderSystem.ts:147-158` (la porte) et `:213-219` (l'écriture) : `RebuildKey` (`:29-35`) ne retient que `(revision, cxMin, cyMin, cxMax, cyMax)`. Or `Grid.cellSize` et `Grid.cellGap` sont des `Vec2` **publics et mutables** (`src/components/Grid.ts:4-5`) qui pilotent `cellOrigin` pour chaque instance (`:181`). Muter `grid.cellSize.x` à l'exécution ne bouscule pas `revision` : **le calque reste figé à l'ancien pas** jusqu'à ce qu'un mouvement de caméra change fortuitement la plage de cellules.

Correctif : ajouter `cellSizeX`/`cellSizeY`/`cellGapX`/`cellGapY` à `RebuildKey` — comparaison scalaire, coût nul. Le tileset étant `public readonly` sur `TileMap` (`src/components/TileMap.ts:7`), il n'a pas besoin d'entrer dans la clé. À noter, trou de test associé : `test/tilemap-rebuild-gate.test.ts:28-31,56` fixe `tileWidth = tileHeight = cellSize = 128`, donc la porte n'est **jamais** exercée avec un `cellSize` différent de la taille native de la tuile.

**Accroche :** `TileMapRenderSystem.ts:29-35` — étendre le type `RebuildKey`, puis les deux sites `:149-156` et `:213-219`.

**À rapprocher de :** [[GAMEPLAY-50-tilemap-hardening-minors]] — sujet voisin mais distinct (celui-ci traite validation `TileSet`, sur-comptage de `revision` et shear).
