---
id: GAMEPLAY-106
status: todo
domain: gameplay
source: "[[tilemap]]"
effort: L
verified: 2026-08-26
---

# Aucun chemin d'entrée depuis un format d'auteur : une `TileMap` ne se remplit que par code

Le moteur livre la chaîne de tuiles complète côté runtime — `TileSet`/`TileSetAsset` dans nebula, `Grid`, `TileMap`, `TileMapRenderer` côté gameplay, `Collider2D` côté physique. Ce qui manque est en amont : `TileMap` n'expose que `setTile`/`getTile`/`removeTile`/`fill`/`clear`/`forEachTile` (`packages/gameplay/src/components/TileMap.ts:22-80`), tous impératifs, sur une `Map<number, number>` privée (`:8`). Il n'existe **aucun importateur**, et `tilemap.md` le confirme par sa décision n°1 : « Périmètre v1 — TileSet + Grid/TileMap code-first ; **JSON reporté** » (`memory/atlas/gameplay/tilemap.md`, §3).

Conséquence : dino-brawl porte tout l'import à la main. `apps/dino-brawl/src/game/tiled/` fait **986 lignes sur 11 fichiers**, plus **430 lignes de tests sur 7 fichiers** (`apps/dino-brawl/test/tiled/`) — soit **1416 lignes** d'infrastructure d'importation dans une application. Le détail :

| fichier | lignes | rôle |
| --- | --- | --- |
| `MapBuilder.ts` | 256 | construction des composants, chargement des tilesets, objets, points nommés |
| `TiledDocument.ts` | 219 | parsing du JSON Tiled, résolution des calques et objets |
| `mapMath.ts` | 73 | mathématiques de grille, placement des tuiles-objets |
| `TiledAssetResolver.ts` | 69 | résolution des tilesets vers des URLs d'assets |
| `ingestOccluders.ts` | 124 | ingestion des occluders |
| `tiled.raw.types.ts` | 61 | types du format brut |
| `ingestColliders.ts` | 58 | ingestion des colliders |
| `resolved.types.ts` | 58 | types résolus |
| `sorting.ts` | 41 | tri / sorting layers |
| `gid.ts` | 19 | décodage des gid (flip flags) |
| `index.ts` | 8 | barrel |

Rien là-dedans n'est propre à dino-brawl **sauf** trois points d'injection déjà isolés : `resolveSortingLayer`, `objectSortingLayer` et `scale` (`MapBuilder.ts:44-49`), plus le `CollisionLayers` importé de `../config`. Le reste est du format Tiled pur.

**Piste : un package `@atlasjs/tiled` dépendant de `gameplay`.** Le sens de la dépendance importe : `gameplay` reste léger et ignore Tiled, et un projet qui n'en veut pas ne l'installe pas. C'est la lecture littérale du `CLAUDE.md` racine — « le noyau doit rester indépendant des systèmes optionnels », « les nouvelles capacités s'introduisent par plugin sans modifier le noyau ». Un importateur de format d'auteur est le cas d'école.

Esquisse, à valider avant d'écrire :
- un `TiledMapAsset` chargeable par l'`AssetManager`, sur le patron `TileSetAsset.fromPath` déjà utilisé par `MapBuilder.ts:79-86` ;
- une ressource `TiledMap` immuable — calques, objets, points nommés — c'est-à-dire ce que `TiledDocument` est déjà, moins le couplage au logger de l'app ;
- un `instantiateTiledMap(ctx, map, options)` avec **résolution de sorting layer injectable** et **fabriques d'objets par type**, les deux seams que `MapBuilder` a déjà découverts empiriquement (`MapBuilderOptions.resolveSortingLayer` en `:47`, et l'aiguillage `if (obj.kind === "point") … else if (obj.kind === "tile")` de `MapBuilder.build` en `:124-127`, qui est une fabrique d'objets par type écrite en dur).

**C'est le seul chantier du lot qui change ce que le moteur *permet*** plutôt que ce qu'il facilite : sans lui, aucun projet AtlasJS ne peut charger un niveau dessiné dans un éditeur, point. C'est aussi le plus lourd, et celui qui gagne le plus à être fait **après** un chargement d'assets par lot : `MapBuilder.build` charge ses tilesets un par un, en série, avec un `await assets.load(...)` **dans la boucle** (`MapBuilder.ts:72-89`) — une carte à cinq tilesets fait cinq allers-retours séquentiels. Voir [[ASSETS-03-asset-bundle-batch-loading]].

**Positionnement par rapport au backlog tilemap existant — vérifié.** Les quatre notes voisines sont des **tranches en aval**, aucune ne porte l'importateur : [[GAMEPLAY-42-tilemap-json-serialization-assetref]] veut un format JSON **propre au moteur** plus une référence de tuile par id (sauvegarde/chargement d'une `TileMap`, pas lecture d'un format tiers) ; [[GAMEPLAY-43-multi-tileset-rich-tile]] veut qu'une cellule pointe un `Tile` riche au lieu d'un entier — c'est le prérequis d'une carte Tiled multi-tileset, que `MapBuilder` contourne aujourd'hui en émettant **une entité-calque par couple (calque, tileset)** — `groupCellsByTileset` (`mapMath.ts:33-46`) puis une boucle `createEntity`/`TileMap`/`TileMapRenderer` par bucket (`MapBuilder.ts:176-207`) ; [[GAMEPLAY-44-tilemap-collider-generation]] veut dériver les colliders des cellules pleines, ce qui remplacerait `ingestColliders.ts` mais ne lit pas Tiled ; [[PHYSICS-02-tiled-collider-ingestion-shapes]] enrichit `ingestColliders` (polygones, ellipses, multi-collider) — c'est un détail à l'intérieur de cette note, et il faudra décider s'il se traite avant ou après la promotion.

**Le doc de design acte l'état actuel comme un fait, pas comme une dette — confirmé.** `memory/atlas/gameplay/tilemap.md:248` écrit : « Aujourd'hui la scène dino-brawl construit sa `Grid` et ses calques depuis Tiled (`tiled/MapBuilder.ts`) », sans commentaire. Et la liste des non-objectifs v1 (`tilemap.md:44`) comme celle du §11 (`:260`) énumèrent la sérialisation JSON, le multi-tileset, les colliders, l'iso/hex, la palette et les optimisations de rendu — **l'import d'un format d'auteur n'y figure nulle part**. Le trou n'est donc pas seulement non implémenté : il n'est pas encore reconnu comme un trou. C'est la première chose que cette note corrige.

**Accroche :** `apps/dino-brawl/src/game/tiled/TiledDocument.ts:29-40` — le constructeur qui prend un `unknown` et le résout en calques/objets/tilesets. C'est la frontière naturelle du futur package : il ne dépend de rien d'AtlasJS sauf du logger, il a déjà 175 lignes de tests (`test/tiled/TiledDocument.test.ts`), et il se déplace tel quel. `MapBuilder`, lui, devra être coupé — la partie « construire des composants » monte dans le package, la partie « quels sorting layers, quels types d'objets » reste à l'app.
