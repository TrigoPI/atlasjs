---
id: GAMEPLAY-72
status: todo
domain: gameplay
effort: M
verified: 2026-08-25
---

# Descendre les assets sprite/tileset dans `@atlasjs/nebula`

Les 7 fichiers de `packages/gameplay/src/assets/` (`Sprite`, `SpriteAsset`, `SpriteLoader`, `Tile`, `TileSet`, `TileSetAsset`, `TileSetLoader`) n'importent que `@atlasjs/math`, `@atlasjs/nebula` et `@atlasjs/assets` — **les trois sont déjà dans le `package.json` de nebula**, qui héberge déjà `src/assets/TextureAsset.ts` + `TextureLoader.ts` et `graphics/TileMapNode.ts` : le déplacement ne crée **aucune nouvelle arête de dépendance**.

Trois gains : (1) il tue une duplication réelle — `packages/nebula/src/animations/Frame.ts:4-13` est `{texture, rect, pivot}` et `gameplay/src/assets/Sprite.ts:11-26` est `{id, texture, rect, pivot}`, le même objet des deux côtés de la frontière, ce qui fait exister `AnimatorSystem.spriteFor` (`src/systems/AnimatorSystem.ts:31-43`) uniquement pour convertir l'un en l'autre ; (2) `@atlasjs/assets` n'est alors plus utilisé nulle part dans gameplay (9 deps → 8) et `ASSET_MANAGER` sort de `requires` (5 → 4, `GameplayPlugin.ts:73-79`) ; (3) l'enregistrement des loaders (`GameplayPlugin.ts:95-96`) descend dans `NebulaPlugin`.

Ce qui bouge côté consommateurs : `components/TileMap.ts:1` et `components/SpriteRender.ts:3` changent d'import, et `apps/dino-brawl` importe ces symboles depuis `@atlasjs/gameplay` (`src/game/loaders/AssetsLoader.ts:5` pour `Sprite`/`SpriteAsset`, `src/game/tiled/MapBuilder.ts:14-26` pour `Sprite`/`Tile`/`TileSet`/`TileSetAsset`) — **mitigation à coût nul** : les ré-exporter depuis `src/index.ts`, exactement comme les lignes 53-58 le font déjà pour `SpriteSheet`/`Frame`. Piège principal : l'ordre de build (nebula puis gameplay), les paquets résolvant par `exports` → `./dist`.

**Accroche :** `packages/gameplay/src/assets/index.ts` — le dossier est déjà refermé sur son barrel, c'est le point de découpe.

**À rapprocher de :** [[GAMEPLAY-08-animator-sprite-cache-eviction]] — une fois `Frame` et `Sprite` co-localisés, leur unification dissout le cache au lieu de lui ajouter une éviction.
