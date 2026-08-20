---
id: GAMEPLAY-48
status: todo
domain: gameplay
source: "[[tilemap]]"
effort: S
verified: 2026-08-19
---

# Util de slicing en grille partagé

`TileSet` reboucle lui-même sa logique de marge/spacing, et `SpriteSheet.fromGrid` (nebula) fait une boucle quasi identique séparément. Extraire un util commun éviterait la duplication.

**Accroche :** `TileSet.ts:32-68` (`packages/gameplay/src/assets/TileSet.ts`) et `SpriteSheet.fromGrid` (`packages/nebula/src/animations/SpriteSheet.ts:86-101`) sont les deux implémentations à unifier.
