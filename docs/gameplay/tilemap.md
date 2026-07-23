# TileSet & TileMap — Design (v1)

> **Statut : ✅ implémenté** (branche `claude/feat/tileset`, commits `53cc7ee`→`b11711d`, 10 tasks TDD + review whole-branch opus « ready to merge »). Plan d'exécution : [`tilemap-plan.md`](tilemap-plan.md). Extensions reportées : [`../backlog.md`](../backlog.md) § *Gameplay — TileSet & TileMap*.
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
  │ assets/     TileSetAsset → TileSetLoader → TileSet    │ graphics/   TileMapNode              │
  │             (Tile = seam fin : index → Sprite) │      │ renderers/  TileMapNodeRenderer      │
  │ components/ Grid, TileMap, TileMapRenderer     │      │             + kind "tilemap"         │
  │ systems/    TileMapRenderSystem  ──────────────┼──────┼──► remplit un TileMapNode / calque   │
  └──────────────────────────────────────────────┘      │             + TileMapBatcher         │
                                                          └────────────────────────────────────┘
```

**Frontière packages** : nebula reste au niveau texture / rect / instances (ne connaît **pas** la notion de tuile) ; gameplay reste au niveau tuile / cellule et traduit vers nebula. Miroir de la répartition `Sprite` (gameplay) ↔ `SpriteNode` (nebula).

## 2. Périmètre v1 & non-objectifs

**Dans le périmètre v1 :**
- `TileSet` en asset complet, découpage en grille (spacing / margin), adressage par index linéaire + helper `(col, row)`.
- `Grid` rectangulaire (`cellSize`, `cellGap`).
- Multi-calque : une `Grid` → N `TileMap` enfants.
- Remplissage **code-first** (`setTile` / `getTile` / `fill` / `clear` / …).
- Rendu instancié via `TileMapNode` dédié, avec culling au viewport.
- Tri par un unique `sortingOrder: int` (cohérent avec `SpriteRender`).

**Non-objectifs v1 (→ [backlog](../backlog.md)) :** (dé)sérialisation JSON + référence de tuile par id ; multi-tileset par tilemap & `Tile` riche (couleur / collider / animation par tuile) ; sorting layers nommés + order-in-layer ; colliders de tilemap ; layouts isométrique / hexagonal + cell swizzle ; palette / éditeur ; optimisations de rendu (buffer d'instances persistant, cache par `revision`, chunking).

## 3. Décisions d'architecture

| # | Décision | Choix retenu |
| --- | --- | --- |
| 1 | Périmètre v1 | TileSet + Grid/TileMap code-first ; **JSON reporté** |
| 2 | Qui possède les tuiles | **L'entité `TileMap` possède la grille de cellules** ; les tuiles **ne sont pas** des entités (modèle Unity, performant) |
| 3 | Ce que stocke une cellule | Un **`int` (index de tuile)**, `-1` = vide ; un `TileSet` unique par tilemap ; abstraction **`Tile` conservée comme seam** d'extension |
| 4 | Structure d'entités | `Grid` (racine) → N `TileMap` enfants (**multi-calque dès la v1**) |
| 5 | Tri | **`sortingOrder: int` seul** ; sorting layers nommés reportés (feature de rendu transverse) |
| 6 | Nature du `TileSet` | **Asset complet** (`TileSetAsset → TileSetLoader → TileSet`) → `id` stable = ancre du futur JSON |
| 7 | Seam de rendu | **`TileMapNode` dédié dans nebula + `NodeRenderer`** (pas un `SpriteNode` par cellule) |
| A | Slicing | `TileSet` fait **sa propre boucle** row-major (util de slicing partagé → backlog) |
| B | Stockage cellules | **`Map` éparse** (coords arbitraires / négatives) ; chunking → backlog |
| C | Teinte | `color: Color` porté par **`TileMapRenderer`** |
| D | Layout | **Rectangulaire uniquement** ; iso / hex + swizzle → backlog |
| E | `cellSize` | **Requis** à la construction de `Grid` (pas de défaut piégeux) |

## 4. Modèle de données

**Coordonnées de cellule** : entiers `(cx, cy)`, convention **Y-down / top-left** cohérente avec la caméra et le reste du moteur (`cy` croissant = vers le bas à l'écran). Coordonnées arbitraires autorisées (y compris négatives).

**Stockage** (décision B) : `Map` éparse `clé packée → index de tuile`. La clé packe `(cx, cy)` de façon bijective sur une plage bornée (offset + décalage) pour rester en `number`. L'absence d'entrée = cellule vide. `revision: number` incrémenté à chaque mutation, pour permettre au rendu de cacher plus tard (v1 : recalcul par frame).

## 5. Couche 1 — `TileSet` (asset)

Placement : `packages/gameplay/src/assets/` (miroir de `Sprite`). Enregistré via `GameplayPlugin.install` (`assets.register(new TileSetLoader())`), comme `SpriteLoader`.

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

**`TileSetLoader`** (`implements AssetLoader<TileSetAsset, TileSet>`, `type = "tileset"`) : `load(asset, ctx)` charge la texture via `ctx.load<Texture2D>(asset.texture)` (dedup gratuit), résout `columns`/`rows` (fournis ou dérivés de la taille texture), puis **sa propre boucle row-major** (décision A) construit `count` `Sprite` — pour chaque cellule `(col, row)` :

```
rectX = margin + col * (tileWidth + spacing)
rectY = margin + row * (tileHeight + spacing)
sprite = new Sprite(texture, { rect: new Bound(rectX, rectY, tileWidth, tileHeight), pivot })
tile   = new Tile(index, sprite)   // index = row * columns + col
```

Les `Sprite` ont un `id` dérivé déterministe (`sprite:${texture.id}:${rect}`) → dedup naturel, atlas-friendly. Le `TileSet.id` stable est l'ancre de référence pour le futur JSON (`tilesetId` + index).

## 6. Couche 2 — composants ECS

Placement : `packages/gameplay/src/components/`. Exposés aux scripts comme **tokens identité** (comme `SpriteRenderer`) via `defineScriptComponent(...)` sans `create` — pas de comportement moteur à cacher en v1.

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
  public constructor(sortingOrder?: number, color?: Color, visible?: boolean);
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
export class TileMapNode extends Node {   // hérite Transformable (position/rotation/scale) + zIndex/visible
  public texture: Texture2D;
  public sampler?: Sampler;
  public blend: BlendMode;    // défaut "alpha"
  public tint: Vec4;
  public instances: TileInstance[];
}
```

- Nouveau `kind: "tilemap"` ajouté à `KIND_ORDER` (`packages/nebula/src/renderers/NodeRenderer.ts`) et à l'union `DrawCommand`. `TileMapDrawCommand` porte `{ kind, sortKey, batchKey, renderState, texture, sampler, tint, instances }`.
- **`TileMapNodeRenderer implements NodeRenderer`** (`kind = "tilemap"`) : `collect(node)` construit **un** `TileMapDrawCommand`, `sortKey` calculé depuis `node.zIndex` + `KIND_ORDER.tilemap` (via `NodeRendererBase.computeSortKey`), `batchKey` = `${texture.id}|${sampler.id}|${blend}`. Le **modèle de chaque instance** est construit exactement comme `SpriteRenderer.buildCommand` (world-matrix du node ∘ translation vers `(x, y)` ∘ scale par `(width, height)`, même convention de quad) — c'est nebula qui possède le lift Mat3→Mat4 et la convention de quad, pas gameplay.
- **`TileMapBatcher implements Batcher`** : réutilise le **`SpriteBatch` backend existant** (`begin(texture, sampler, renderState)` + `add(model, uvRect, tint)` par instance) → **un draw call instancié** pour tout le calque visible.
- Enregistrement : `TileMapNodeRenderer` ajouté au tableau `nodeRenderers` de `SceneRenderer`, avec son `Batcher` dans le `RenderQueue`.

### 7.2 Côté gameplay — `TileMapRenderSystem`

Lane `render` / stage `PreRender` (comme `SpriteRenderSystem`), après `CameraSyncSystem`. `SparseSet<TileMapNode>` pour tracker un node par entité-calque.

Par frame, `query(WorldTransform2D, TileMap, TileMapRenderer).each((layer, worldTransform, tileMap, renderer) => …)` :
1. Résout la `Grid` du **parent** : `grid = world.getComponent(world.getParent(layer), Grid)`. Si absente → skip (warn dev).
2. Monte le `TileMapNode` à la volée si absent (`nebula.scene.addChild`) ; décompose `worldTransform.matrix` → `node.setPosition/setRotation/setScale` (même décomposition TRS lossy que `SpriteRenderSystem`).
3. **Culling** : convertit le viewport (`getCameraViewport()`, world-space `Bound`) en plage de cellules via l'inverse de la world-matrix du calque → AABB local → division par `stride = cellSize + cellGap` → `[cxMin..cxMax] × [cyMin..cyMax]` clampée.
4. Reconstruit `node.instances` : pour chaque cellule visible non-vide, `tile = tileMap.tileset.getTile(index)` → `x, y = stride * (cx, cy)` (origine cellule, espace local), `width, height = tile.sprite.rect.{width,height}`, `uvRect = tile.sprite.rect` normalisé par la taille texture.
5. Sync : `node.texture = tileset.texture`, `node.tint = renderer.color`, `node.zIndex = renderer.sortingOrder`, `node.visible = renderer.visible`.

**Lifecycle** : démontage via `world.onRemove(TileMap, entity => system.unmount(entity))` dans `GameplayPlugin` (retire le node de la scène + supprime l'entrée du sparse-set), même pattern que `SpriteRenderSystem.unmount`.

**Perf v1** : la liste d'instances *visibles* est reconstruite chaque frame (aucun churn de node — c'est le gain vs "un `SpriteNode` par cellule"). Cache par `revision` + plage-visible et buffer d'instances persistant (static batch) → backlog.

**Placement de la tuile (v1)** : ancrée au **coin d'origine** de la cellule, dessinée à sa taille native (`rect`). Le `pivot` du sprite n'intervient pas dans le placement de tuile en v1 ; un « Tile Anchor » configurable et le scaling *fit-to-cell* → backlog.

## 8. Enregistrements & placement des fichiers

| Élément | Package / dossier | Enregistrement |
| --- | --- | --- |
| `Tile`, `TileSetAsset`, `TileSet`, `TileSetLoader` | `gameplay/src/assets/` | loader dans `GameplayPlugin.install` |
| `Grid`, `TileMap`, `TileMapRenderer` | `gameplay/src/components/` | tokens identité dans `gameplay/src/scripting/components/` |
| `TileMapRenderSystem` | `gameplay/src/systems/` | `registerSystem(render, …, { stage: "PreRender" })` + `world.onRemove(TileMap, …)` |
| `TileMapNode` | `nebula/src/graphics/` | — |
| `TileMapNodeRenderer`, `TileMapBatcher`, `TileMapDrawCommand`, `kind "tilemap"` | `nebula/src/renderers/` | dans `SceneRenderer.nodeRenderers` + `RenderQueue` |

Barrels : réexport depuis `gameplay/src/index.ts` (comme `Sprite`/`SpriteSheet`) et `nebula/src/index.ts`.

**Note de nommage** : le composant ECS public s'appelle `TileMapRenderer` (nom Unity) ; le `NodeRenderer` nebula s'appelle **`TileMapNodeRenderer`** pour éviter la collision (nebula nomme déjà ses `NodeRenderer` `SpriteRenderer`/`ShapeRenderer`).

## 9. Exemple code-first (cible sandbox)

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

Remplace la double-boucle de ~15 lignes de [`apps/sandbox/src/game/EcsScene.ts`](../../apps/sandbox/src/game/EcsScene.ts) (100 entités-tuiles).

## 10. Stratégie de test

- **`TileSet` (unitaire, sans GPU)** : slicing row-major correct (indices, rects) avec/sans `spacing`/`margin` ; `indexOf(col,row)` bijectif ; `count = columns*rows` ; `getTile` hors-bornes throw, `tryGetTile` undefined. Texture mockée (`{ id, width, height }`).
- **`TileMap` (unitaire)** : `setTile`/`getTile`/`removeTile`/`hasTile`, `-1` efface, `fill` sur une plage, `clear`, `revision` incrémenté à chaque mutation, coordonnées négatives.
- **Culling (unitaire)** : plage de cellules visibles pour un viewport donné (bords, échelle, translation du calque).
- **`TileMapRenderSystem` (intégration ECS)** : node monté/démonté sur add/remove `TileMap` ; `sortingOrder → zIndex` ; instances reconstruites après mutation ; skip si pas de `Grid` parente.
- **Vérif navigateur** (obligatoire) : la scène sandbox réécrite rend la grille correctement, multi-calque trié, batch en un draw call (via les outils de preview). Les fichiers d'app/scripts doivent `import type` les symboles type-only (sinon `tsc` passe mais Vite casse au runtime — écran noir).

## 11. Non-objectifs / backlog

Voir la section **Gameplay — TileSet & TileMap** de [`docs/backlog.md`](../backlog.md) pour la liste complète des reports (JSON/sérialisation, multi-tileset & `Tile` riche, sorting layers nommés, colliders de tilemap, iso/hex, palette/éditeur, optimisations de rendu, util de slicing partagé, tile anchor / fit-to-cell).
