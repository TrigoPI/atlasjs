---
id: GAMEPLAY-50
status: todo
domain: gameplay
source: "[[tilemap]]"
effort: S
verified: 2026-08-19
---

# Durcissements tilemap (validation, revision, culling sous shear)

Trois manques mineurs acceptés en v1 : `TileSet` ne valide pas des `columns`/`rows` explicites surdimensionnés vis-à-vis de la texture ; `TileMap.setTile` incrémente `currentRevision` même en réécriture identique, ce qui déclenche un rebuild de cache inutile ; et le culling peut potentiellement diverger du rendu sous shear + scale non-uniforme (non vérifié isolément).

**Accroche :** `TileSet.ts:32-40` et `TileMap.setTile` (`packages/gameplay/src/assets/TileMap.ts:22-30`) localisent les deux premiers points ; le troisième touche `systems/utils/tilemap-geometry.ts`.
