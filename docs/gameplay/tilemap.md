# TileSet & TileMap — Design (v1)

> **Statut : ✅ implémenté** (mergé sur `dev`). Extensions reportées : [`../backlog/`](../backlog/).
>
> **Note de rendu (piège vérifié en vrai)** : une tuile est dessinée à la **taille native** de son sprite, positionnée à l'origine de sa cellule. Pour un tiling **sans trou**, `Grid.cellSize` doit **égaler la taille native de la tuile** (ex. `128`) ; pour agrandir le rendu, on **scale l'entité `Grid`** (son `Transform2D`), ce qui se propage au calque — on ne gonfle **pas** `cellSize`. Mettre `cellSize` = taille × facteur tout en dessinant à taille native laisse des trous (le *fit-to-cell scaling* qui lèverait cette contrainte est au backlog).

## 1. Vue d'ensemble

Objectif : un système de tuiles façon Unity, en trois couches empilées.

1. **`TileSet` (asset)** — découpe une texture en un ensemble de tuiles *adressables par index*, exactement sur le modèle `SpriteAsset → SpriteLoader → Sprite`.
2. **`Grid` + `TileMap` + `TileMapRenderer` (composants ECS)** — une entité `Grid` (racine, système de coordonnées) porte N entités-enfants `TileMap` (les **calques**), chacune tenant ses données de cellules + son rendu. Reproduit fidèlement la séparation Unity `Grid`/`Tilemap`/`TilemapRenderer`, motivée par le **multi-calque** (sol / murs / déco partageant une même grille).
3. **Rendu** — un `TileMapNode` dédié dans nebula + un `NodeRenderer` branché sur le seam existant ; un `TileMapRenderSystem` côté gameplay traduit les cellules visibles en instances. **Un draw call instancié par calque visible**.

```
                        @atlasjs/gameplay                           @atlasjs/nebula
  ┌──────────────────────────────────────────────┐      ┌────────────────────────────────────┐
  │ components/ Grid, TileMap, TileMapRenderer     │      │ assets/     TileSetAsset →           │
  │             (Tile / TileSet ré-exportés        │      │             TileSetLoader → TileSet  │
  │              depuis nebula par le barrel)      │      │             (Tile = seam fin)        │
  │ systems/    TileMapRenderSystem  ──────────────┼──────┼──► graphics/  TileMapNode            │
  │                                                │      │    renderers/ TileMapNodeRenderer    │
  └──────────────────────────────────────────────┘      │               + kind "tilemap"        │
                                                          │               + TileMapBatcher       │
                                                          └────────────────────────────────────┘
```

**Frontière packages** (état actuel) : nebula possède l'**asset** tileset (`Tile`/`TileSet`/`TileSetAsset`/`TileSetLoader`, au même titre que `Sprite`/`SpriteAsset`/`SpriteLoader`) **et** le seam de rendu (`TileMapNode`) ; gameplay possède la **grille et les cellules** (`Grid`/`TileMap`/`TileMapRenderer`) et traduit les cellules visibles en instances. Le barrel gameplay **ré-exporte** les symboles tileset de nebula pour que le code de jeu n'ait qu'un import.

## 2. Périmètre v1 & non-objectifs

**Dans le périmètre v1 :**
- `TileSet` en asset complet, découpage en grille (spacing / margin), adressage par index linéaire + helper `(col, row)`.
- `Grid` rectangulaire (`cellSize`, `cellGap`).
- Multi-calque : une `Grid` → N `TileMap` enfants.
- Remplissage **code-first** (`setTile` / `getTile` / `fill` / `clear` / …).
- Rendu instancié via `TileMapNode` dédié, avec culling au viewport.
- Tri par un unique `sortingOrder: int` (cohérent avec `SpriteRender`). *(Depuis, les **sorting layers nommés** ont été implémentés — cf. §6 et `src/rendering/SortingLayers.ts` : `TileMapRenderer` porte aussi un `sortingLayer: string`.)*

**Non-objectifs v1 (→ [backlog](../backlog/)) :** (dé)sérialisation JSON + référence de tuile par id ; multi-tileset par tilemap & `Tile` riche (couleur / collider / animation par tuile) ; colliders de tilemap ; layouts isométrique / hexagonal + cell swizzle ; palette / éditeur ; optimisations de rendu (buffer d'instances persistant, chunking). *(Livrés depuis : les **sorting layers nommés** et le **cache par `revision`**, cf. §7.2.)*

## 3. Décisions d'architecture

| # | Décision | Choix retenu |
| --- | --- | --- |
| 1 | Périmètre v1 | TileSet + Grid/TileMap code-first ; **JSON reporté** |
| 2 | Qui possède les tuiles | **L'entité `TileMap` possède la grille de cellules** ; les tuiles **ne sont pas** des entités (modèle Unity, performant) |
| 3 | Ce que stocke une cellule | Un **`int` (index de tuile)**, `-1` = vide ; un `TileSet` unique par tilemap ; abstraction **`Tile` conservée comme seam** d'extension |
| 4 | Structure d'entités | `Grid` (racine) → N `TileMap` enfants (**multi-calque dès la v1**) |
| 5 | Tri | v1 : **`sortingOrder: int` seul** ; **aujourd'hui** : `sortingLayer: string` + `sortingOrder`, résolus par `SortingLayers`/`applySortFields` (feature de rendu transverse livrée depuis) |
| 6 | Nature du `TileSet` | **Asset complet** (`TileSetAsset → TileSetLoader → TileSet`) → `id` stable = ancre du futur JSON |
| 7 | Seam de rendu | **`TileMapNode` dédié dans nebula + `NodeRenderer`** (pas un `SpriteNode` par cellule) |
| A | Slicing | `TileSet` fait **sa propre boucle** row-major (util de slicing partagé → backlog) |
| B | Stockage cellules | **`Map` éparse** (coords arbitraires / négatives) ; chunking → backlog |
| C | Teinte | `color: Color` porté par **`TileMapRenderer`** |
| D | Layout | **Rectangulaire uniquement** ; iso / hex + swizzle → backlog |
| E | `cellSize` | **Requis** à la construction de `Grid` (pas de défaut piégeux) |

## 4. Modèle de données

**Coordonnées de cellule** : entiers `(cx, cy)`, convention **Y-down / top-left** cohérente avec la caméra et le reste du moteur (`cy` croissant = vers le bas à l'écran). Coordonnées arbitraires autorisées (y compris négatives).

**Stockage** (décision B) : `Map` éparse `clé packée → index de tuile`. La clé packe `(cx, cy)` de façon bijective sur une plage bornée (offset + décalage) pour rester en `number`. L'absence d'entrée = cellule vide. `revision: number` incrémenté à chaque mutation — consommé par le cache de reconstruction du `TileMapRenderSystem` (§7.2).

## 5. Couche 1 — `TileSet` (asset)

Placement : `packages/nebula/src/assets/` (miroir de `Sprite`, dans le même package). Enregistré via `NebulaPlugin.install` (`assets.register(new TileSetLoader())`), comme `SpriteLoader`. Ré-exporté par le barrel `@atlasjs/gameplay` pour le code de jeu.

```ts
// Tile.ts — le seam fin (aujourd'hui : juste index + sprite)
export class Tile {
  public readonly index: number;   // index linéaire dans le tileset (row-major)
  public readonly sprite: Sprite;
  public constructor(index: number, sprite: Sprite);
}

// TileSetAsset.ts — descripteur sérialisable (implements Asset)
export interface TileSetAssetOptions {
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly columns?: number;   // sinon dérivé : floor((texW - 2*margin + spacing) / (tileWidth + spacing))
  readonly rows?: number;      // idem sur la hauteur
  readonly spacing?: number;   // défaut 0
  readonly margin?: number;    // défaut 0
  readonly pivot?: Vec2;       // défaut (0.5, 0.5) — porté par chaque Sprite de tuile
  readonly id?: string;
}
export class TileSetAsset implements Asset {
  public readonly type: string = "tileset";
  public readonly id: string;              // dérivé : `tileset:${texture.id}:${tw}x${th}:${cols}x${rows}:${spacing}:${margin}`
  public readonly texture: TextureAsset;   // référence par valeur (composition), comme SpriteAsset
  // + champs de découpage
  public constructor(texture: TextureAsset, options: TileSetAssetOptions);
  public static fromPath(path: string, options: TileSetAssetOptions): TileSetAsset;
}

// TileSet.ts — resource runtime (implements Resource)
export class TileSet implements Resource {
  public readonly id: string;
  public readonly texture: Texture2D;
  public readonly columns: number;
  public readonly rows: number;
  public get count(): number;                              // columns * rows
  public getTile(index: number): Tile;                     // throw si hors bornes [0, count)
  public tryGetTile(index: number): Tile | undefined;      // undefined si hors bornes
  public indexOf(col: number, row: number): number;        // (col, row) → index linéaire (row-major)
  public destroy(): void;                                  // no-op : la Texture2D est possédée par l'AssetManager
}
```

**`TileSetLoader`** (`implements AssetLoader<TileSetAsset, TileSet>`, `type = "tileset"`) : `load(asset, ctx)` charge la texture via `ctx.load<Texture2D>(asset.texture)` (dedup gratuit) puis délègue à `new TileSet(texture, options)`. C'est le **constructeur de `TileSet`** qui résout `columns`/`rows` (fournis ou dérivés de la taille texture) et fait **sa propre boucle row-major** (décision A) pour construire `count` `Sprite` — pour chaque cellule `(col, row)` :

```
rectX = margin + col * (tileWidth + spacing)
rectY = margin + row * (tileHeight + spacing)
sprite = new Sprite(texture, { rect: new Bound(rectX, rectY, tileWidth, tileHeight), pivot })
tile   = new Tile(index, sprite)   // index = row * columns + col
```

Les `Sprite` ont un `id` dérivé déterministe (`sprite:${texture.id}:${rect}`) → dedup naturel, atlas-friendly. Le `TileSet.id` stable est l'ancre de référence pour le futur JSON (`tilesetId` + index).

## 6. Couche 2 — composants ECS

Placement : `packages/gameplay/src/components/`. Composants **LEVEL 1** (données pures Nexus), utilisés **bruts** par les scripts et réexportés depuis `packages/gameplay/src/index.ts` — pas de token scripting dédié ni de comportement moteur à cacher en v1.

```ts
// Grid.ts — géométrie des cellules (le parent = système de coordonnées)
export class Grid {
  public cellSize: Vec2;   // requis (décision E) — espacement entre origines de cellules, en unités monde
  public cellGap: Vec2;    // défaut (0, 0)
  public constructor(cellSize: Vec2, cellGap?: Vec2);
}

// TileMap.ts — un calque : données de cellules + son tileset
export class TileMap {
  public readonly tileset: TileSet;
  public get revision(): number;

  public setTile(cx: number, cy: number, tileIndex: number): void;   // tileIndex < 0 ⇒ efface (comme removeTile)
  public getTile(cx: number, cy: number): number;                    // -1 si vide
  public hasTile(cx: number, cy: number): boolean;
  public removeTile(cx: number, cy: number): void;
  public fill(cx0: number, cy0: number, cx1: number, cy1: number, tileIndex: number): void;
  public clear(): void;
  public forEachTile(fn: (cx: number, cy: number, tileIndex: number) => void): void;   // pour le rendu / debug

  public constructor(tileset: TileSet);
}

// TileMapRenderer.ts — params de rendu du calque
export class TileMapRenderer {
  public sortingOrder: number;   // défaut 0
  public color: Color;           // teinte du calque (décision C), défaut White
  public visible: boolean;       // défaut true
  public sortingLayer: string;   // couche nommée résolue par SortingLayers, défaut "Default"
  public constructor(sortingOrder?: number, color?: Color, visible?: boolean, sortingLayer?: string);
}
```

**Contrainte de propagation** : la `Grid` racine **doit** porter un `Transform2D` (le `TransformPropagationSystem` enracine la forêt sur `query(Transform2D).without(Parent)`). Chaque calque `TileMap` porte aussi un `Transform2D` (identité en général) et est rattaché via `nexus.setParent(layer, grid)`.

## 7. Couche 3 — rendu

### 7.1 Côté nebula (ajouts prévus par l'archi renderer)

```ts
// graphics/TileMapNode.ts — un "sac d'instances d'une texture", en espace local du calque
export interface TileInstance {
  x: number; y: number;            // origine de la cellule (coin min) en espace local du calque
  width: number; height: number;   // taille native de la tuile (taille du rect du sprite)
  uvRect: Vec4;                     // rect de la tuile normalisé par la taille de la texture
}
export class TileMapNode extends Node {   // hérite Transformable (position/rotation/scale) + visible + sortingLayer/sortPrimary/sortSecondary
  public texture: Texture2D | null;   // null tant que le système n'a pas sync le calque
  public sampler?: Sampler;
  public blend: BlendMode;    // défaut "alpha"
  public tint: Vec4;
  public instances: TileInstance[];
}
```

- Nouveau `kind: "tilemap"` ajouté à `KIND_ORDER` (`packages/nebula/src/renderers/NodeRenderer.ts`) et à l'union `DrawCommand`. `TileMapDrawCommand` porte `{ kind, sortingLayer, sortPrimary, sortSecondary, kindOrder, batchKey, renderState, texture, sampler, tint, models, uvRects, count }`.
- **`TileMapNodeRenderer implements NodeRenderer`** (`kind = "tilemap"`) : `collect(node)` construit **un** `TileMapDrawCommand` (ou `null` si pas de texture / zéro instance), recopie les champs de tri du node (`sortingLayer`/`sortPrimary`/`sortSecondary`) et pose `kindOrder = KIND_ORDER.tilemap` ; `batchKey` est un **entier interné** par clé matériau `${texture.id}|${sampler.id}|${blend}`. Le **modèle de chaque instance** est construit comme dans `SpriteRenderer` (world-matrix du node ∘ translation vers le **centre** `(x + width/2, y + height/2)` ∘ scale par `(width, height)`, même convention de quad) — c'est nebula qui possède le lift Mat3→Mat4 et la convention de quad, pas gameplay.
- **`TileMapBatcher implements Batcher`** : réutilise le **`SpriteBatch` backend existant** (`begin(texture, sampler, renderState)` + `add(model, uvRect, tint)` par instance) → **un draw call instancié** pour tout le calque visible.
- Enregistrement : `TileMapNodeRenderer` ajouté au tableau `nodeRenderers` de `SceneRenderer`, avec son `Batcher` dans le `RenderQueue`.

### 7.2 Côté gameplay — `TileMapRenderSystem`

Lane `render` / stage `PreRender` (comme `SpriteRenderSystem`), après `CameraSyncSystem`. `Map<Entity, TileMapNode>` pour tracker un node par entité-calque (+ une `Map<Entity, RebuildKey>` pour le cache d'instances).

Par frame, `query(WorldTransform2D, TileMap, TileMapRenderer).each((layer, worldTransform, tileMap, renderer) => …)` :
1. Résout la `Grid` du **parent** : `grid = world.getComponent(world.getParent(layer), Grid)`. Si absente → skip (warn dev).
2. Monte le `TileMapNode` à la volée si absent (`nebula.scene.addChild`) ; décompose `worldTransform.matrix` → `node.setPosition/setRotation/setScale` (même décomposition TRS lossy que `SpriteRenderSystem`).
3. **Culling** : convertit le viewport (`getCameraViewport()`, world-space `Bound`) en plage de cellules via l'inverse de la world-matrix du calque → AABB local → division par `stride = cellSize + cellGap` → `[cxMin..cxMax] × [cyMin..cyMax]` clampée.
4. Reconstruit `node.instances` : pour chaque cellule visible non-vide, `tile = tileMap.tileset.tryGetTile(index)` (index hors tileset ⇒ cellule sautée) → `x, y = cellOrigin(cellSize, cellGap, cx, cy)` (origine cellule, espace local), `width, height = tile.sprite.rect.{width,height}`, `uvRect = tile.sprite.rect` normalisé par la taille texture.
5. Sync : `node.texture = tileset.texture`, `node.tint = renderer.color`, `node.visible = renderer.visible`, et les champs de tri via `applySortFields(node, sortingLayers, renderer.sortingLayer, renderer.sortingOrder, positionY)` — qui écrit `node.sortingLayer` + `sortPrimary`/`sortSecondary` selon le mode (`manual` ⇒ `sortPrimary = sortingOrder` ; `ySorted` ⇒ `sortPrimary = worldY`, `sortSecondary = sortingOrder`).

**Lifecycle** : démontage via `world.onRemove(TileMap, entity => system.unmount(entity))` dans `GameplayPlugin` (retire le node de la scène + supprime les entrées des deux `Map`), même pattern que `SpriteRenderSystem.unmount`.

**Perf** : la liste d'instances *visibles* n'est reconstruite que si la **clé de rebuild** change — `{ revision, plage de cellules visible, cellSize, cellGap }` mémorisée par entité (`RebuildKey`) ; sinon la passe sort tôt. Le tableau `node.instances` est réutilisé en place (les objets `TileInstance` sont recyclés, seul `length` est ajusté) — aucun churn de node. Buffer d'instances GPU persistant (static batch) et chunking → backlog.

**Placement de la tuile (v1)** : ancrée au **coin d'origine** de la cellule, dessinée à sa taille native (`rect`). Le `pivot` du sprite n'intervient pas dans le placement de tuile en v1 ; un « Tile Anchor » configurable et le scaling *fit-to-cell* → backlog.

## 8. Enregistrements & placement des fichiers

| Élément | Package / dossier | Enregistrement |
| --- | --- | --- |
| `Tile`, `TileSetAsset`, `TileSet`, `TileSetLoader` | `nebula/src/assets/` | loader dans `NebulaPlugin.install` ; ré-exportés par `gameplay/src/index.ts` |
| `Grid`, `TileMap`, `TileMapRenderer` | `gameplay/src/components/` | composants LEVEL 1, réexportés bruts via `gameplay/src/index.ts` |
| `TileMapRenderSystem` | `gameplay/src/systems/` | `registerSystem(render, …, { stage: "PreRender" })` + `world.onRemove(TileMap, …)` |
| `TileMapNode` | `nebula/src/graphics/` | — |
| `TileMapNodeRenderer`, `TileMapBatcher`, `TileMapDrawCommand`, `kind "tilemap"` | `nebula/src/renderers/` | dans `SceneRenderer.nodeRenderers` + `RenderQueue` |

Barrels : réexport depuis `gameplay/src/index.ts` (comme `Sprite`/`SpriteSheet`) et `nebula/src/index.ts`.

**Note de nommage** : le composant ECS public s'appelle `TileMapRenderer` (nom Unity) ; le `NodeRenderer` nebula s'appelle **`TileMapNodeRenderer`** pour éviter la collision (nebula nomme déjà ses `NodeRenderer` `SpriteRenderer`/`ShapeRenderer`).

## 9. Exemple code-first (cible dino-brawl)

```ts
// 1. Charger le tileset (asset complet)
const grassTilesetAsset = TileSetAsset.fromPath(GrassTileset, { tileWidth: 128, tileHeight: 128 });
const grassTileset = await assets.load<TileSet>(grassTilesetAsset);

// 2. La Grid (racine — porte un Transform2D)
const grid = nexus.createEntity();
nexus.addComponent(grid, Grid, new Vec2(128, 128));   // cellSize
nexus.addComponent(grid, Transform2D);

// 3. Un calque "sol", enfant de la grid
const ground = nexus.createEntity();
const groundMap = nexus.addComponent(ground, TileMap, grassTileset);
nexus.addComponent(ground, TileMapRenderer, 0);       // sortingOrder = 0
nexus.addComponent(ground, Transform2D);
nexus.setParent(ground, grid);

// 4. Remplir (code-first)
groundMap.fill(0, 0, 9, 9, grassTileset.indexOf(0, 1));
groundMap.setTile(5, 5, grassTileset.indexOf(2, 0));

// (calques "murs"/"déco" = mêmes lignes avec sortingOrder 10, 20…)
```

A remplacé la double-boucle de ~15 lignes de l'ancien `apps/dino-brawl/src/game/EcsScene.ts` (100 entités-tuiles). Aujourd'hui la scène dino-brawl construit sa `Grid` et ses calques depuis Tiled ([`tiled/MapBuilder.ts`](../../apps/dino-brawl/src/game/tiled/MapBuilder.ts)).

## 10. Stratégie de test

- **`TileSet` (unitaire, sans GPU)** : slicing row-major correct (indices, rects) avec/sans `spacing`/`margin` ; `indexOf(col,row)` bijectif ; `count = columns*rows` ; `getTile` hors-bornes throw, `tryGetTile` undefined. Texture mockée (`{ id, width, height }`).
- **`TileMap` (unitaire)** : `setTile`/`getTile`/`removeTile`/`hasTile`, `-1` efface, `fill` sur une plage, `clear`, `revision` incrémenté à chaque mutation, coordonnées négatives.
- **Culling (unitaire)** : plage de cellules visibles pour un viewport donné (bords, échelle, translation du calque).
- **`TileMapRenderSystem` (intégration ECS)** : node monté/démonté sur add/remove `TileMap` ; `sortingLayer`/`sortingOrder` → champs de tri du node ; instances reconstruites après mutation et **pas** reconstruites quand la clé de rebuild est inchangée ; skip si pas de `Grid` parente.
- **Vérif navigateur** (obligatoire) : la scène `dino-brawl` réécrite rend la grille correctement, multi-calque trié, batch en un draw call (via les outils de preview). Les fichiers d'app/scripts doivent `import type` les symboles type-only (sinon `tsc` passe mais Vite casse au runtime — écran noir).

## 11. Non-objectifs / backlog

Voir le [backlog](../backlog/) pour la liste complète des reports (JSON/sérialisation, multi-tileset & `Tile` riche, colliders de tilemap, iso/hex, palette/éditeur, optimisations de rendu restantes — buffer d'instances persistant, chunking —, util de slicing partagé, tile anchor / fit-to-cell). Les **sorting layers nommés** et le **cache par `revision`** ont depuis été implémentés.
