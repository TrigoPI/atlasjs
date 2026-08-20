---
id: GAMEPLAY-43
status: todo
domain: gameplay
source: "[[tilemap]]"
effort: M
verified: 2026-08-19
---

# Multi-tileset par tilemap + `Tile` riche

Une cellule de `TileMap` ne pointe qu'un `number` (index) dans un unique `TileSet`, et `Tile` se limite à `{ index, sprite }` : ni couleur, ni `colliderType`, ni tuile animée par tuile, ni agrégation de plusieurs tilesets. Reste à faire pointer la cellule vers un `Tile` riche plutôt qu'un entier brut.

**Accroche :** le seam `Tile` (`packages/gameplay/src/assets/Tile.ts`) est déjà en place, seul son contenu doit s'enrichir.
