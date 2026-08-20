---
id: GAMEPLAY-49
status: todo
domain: gameplay
source: "[[tilemap]]"
effort: M
verified: 2026-08-19
---

# Tile Anchor configurable + scaling fit-to-cell

Une tuile est toujours dessinée à sa taille native, ancrée au coin d'origine de la cellule (`instance.width/height = rect.width/height`, jamais `grid.cellSize`) : aucun champ d'ancrage n'existe sur `TileMapRenderer`/`Tile`. Reste à permettre un ancrage centré et un redimensionnement à `cellSize`, ce qui lèverait la contrainte actuelle « `cellSize` = taille native ».

**Accroche :** `TileMapRenderSystem.ts:196-199` (`packages/gameplay/src/rendering/TileMapRenderSystem.ts`) est le point d'assignation exact à rendre configurable.
