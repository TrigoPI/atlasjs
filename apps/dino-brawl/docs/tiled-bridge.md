# Bridge Tiled → Atlas (dino-brawl) — Design

> **Statut : ✅ implémenté**, et allant au-delà du périmètre fixé en §2. App-local (`apps/dino-brawl`). Le bridge (`TiledDocument`, `gid.ts`, `MapBuilder`, `TiledAssetResolver`, `sorting.ts`) est en place dans `src/game/tiled/` ; `ingestColliders.ts`/`ingestOccluders.ts` (+ leurs tests) consomment déjà les rects de collision/occlusion pour spawner du monde solide et des occluders — un périmètre que §2 classait pourtant en « non-objectif, backlog suivant ».
>
> **Contexte** : un proto de bridge existe déjà dans `apps/dino-brawl/src/game/tiled/` (`MapLoader` + `LayerManager` + `TileSetManager` + `MapObjectManager` + `TileMapBuilderScript`). Il fonctionne mais porte plusieurs bugs et hypothèses fragiles (voir §10). Ce design **refond** ce proto proprement.

## 1. Vue d'ensemble

Objectif : un bridge **data-driven** qui prend l'export JSON de [Tiled](https://www.mapeditor.org/) (`.tmj`) et construit la scène dino-brawl — grille + calques de tuiles + objets — en réutilisant les briques gameplay existantes (`Grid` / `TileMap` / `TileMapRenderer`, `SpriteRenderer`, sorting layers).

Deux difficultés propres à Tiled, qui motivent le design :

1. **Les gid sont « aléatoires ».** Tiled numérote les tuiles globalement : le premier tileset chargé commence à `firstgid = 1`, le suivant à `1 + tilecount`, etc. Un `gid` d'une cellule doit être mappé vers `(tileset, index interne)`. De plus les 3 bits de poids fort d'un `gid` encodent des flips (H/V/diagonal).
2. **Deux familles de calques.** Les *tile layers* (grille de tuiles pure) et les *object layers* (objets libres) — ces derniers portant potentiellement des sprites que le joueur croise **devant/derrière** (Y-sort) et des zones de **collision**.

## 2. Périmètre & non-objectifs

**Dans le périmètre :**
- Parse du JSON Tiled en un modèle typé **résolu** (gid → `{tileset, localIndex, flip}`, calques aplatis avec leur chemin de groupe, objets typés).
- Résolution `gid → index interne` correcte, y compris masquage des flip-flags et multi-tileset par calque.
- Construction ECS : `Grid` + calques `TileMap` (splittés par tileset), entités-sprites pour les tile-objects (Y-sortées), et **exposition des rectangles de collision en data**.
- Un `resolver` d'assets côté app (contrainte Vite) et une politique de sorting par convention de nom de groupe.

**Non-objectifs (→ plus tard / backlog) :**
- **Spawn de colliders** : la collision est *data-only* dans cette tâche. Aucun `Collider2D`/`RigidBody2D` n'est créé ; les shapes sont exposées pour le feature *tilemap collision* suivant.
- Rendre les **calques de tuiles** solides (world solidity) — feature suivant.
- Collision **par-tuile** (objectgroup de collision défini sur une tuile dans Tiled).
- **Custom properties** riches / typées (on conserve seulement le sac brut `properties`).
- Sorting via custom property `sortingLayer` par calque (évolution v2, cf. §8).
- Layouts iso/hex, animation de tuiles, promotion en package moteur `@atlasjs/tiled`.

## 3. Architecture

Deux couches app-local + deux hooks fournis par l'app.

```
                 apps/dino-brawl/src/game/tiled/
  ┌──────────────────────────────────────────────────────────────┐
  │  TiledDocument   (parse pur, ZÉRO dépendance moteur)           │
  │    JSON brut ─► modèle résolu : tilesets, tileLayers, objects  │
  │    • masque les flip-flags, gid → {tileset, localIndex}        │
  │    • aplatit les groupes (groupPath), objets typés             │
  │    • skip les tilesets sans image (ex. `test`)                 │
  └───────────────────────────────┬──────────────────────────────┘
                                   │  (modèle résolu, testable sans GPU)
  ┌───────────────────────────────▼──────────────────────────────┐
  │  MapBuilder   (instanciation ECS)                              │
  │    build(ctx, doc, options) ─► BuiltMap                        │
  │    • charge chaque tileset via AssetManager (resolver → URL)   │
  │    • Grid + calques TileMap (split multi-tileset)              │
  │    • tile-objects → entités SpriteRenderer (Entities/ySort)    │
  │    • rect-objects → BuiltMap.colliders (data, coords monde)    │
  └────────────────────────────────────────────────────────────── ┘
        ▲                                   ▲
        │ TiledAssetResolver                │ resolveSortingLayer
        │ (import.meta.glob, §6)            │ (convention nom de groupe, §8)
        └───────────── fournis par l'app (spawnWorld / config) ────┘
```

**Principe de frontière** : `TiledDocument` ne connaît ni l'ECS, ni les assets, ni Vite — c'est du parsing pur, unit-testable. `MapBuilder` orchestre l'ECS. Les deux morceaux Vite/policy (résolution d'URL, mapping sorting) sont injectés par l'app via des seams étroits — exactement ce qui permettrait, plus tard, d'extraire le bridge en package moteur sans y traîner `import.meta.glob`.

## 4. Décisions d'architecture

| # | Décision | Choix retenu |
| --- | --- | --- |
| 1 | Découpage | **`TiledDocument` (parse pur) + `MapBuilder` (ECS)** ; hooks app pour assets + sorting |
| 2 | Mapping gid | **row-flip** Tiled→Atlas obligatoire : `localIndex = (rows-1 - tiledRow)*columns + col` (Tiled numérote top→bottom, Atlas bottom→top), `rows = tileCount/columns` |
| 3 | Flip-flags | Masqués sur les 3 bits hauts ; `flipX/flipY` exposés (cellules **et** tile-objects) |
| 4 | Multi-tileset / calque | Un calque Tiled est **splitté** en N enfants `TileMap` (un par tileset utilisé) |
| 5 | Collision | **Data-only** : rects exposés dans `BuiltMap.colliders` (coords monde) ; aucun `Collider2D` spawné |
| 6 | Tile-objects | Entités `SpriteRenderer` en sorting layer `Entities` (ySort par `worldY`), ancrées à leur **base** |
| 7 | Assets | `resolver` app via `import.meta.glob` (§6), matché sur le champ `image` |
| 8 | Sorting | Convention **nom de groupe** (case-insensitive) + override optionnel ; défaut tile-object = `Entities` (§8) |
| 9 | Tilesets sans image | Skippés par `TiledDocument` (ex. le tileset bidon `test`) + warn |

## 5. Couche 1 — `TiledDocument` (parse pur)

Placement : `apps/dino-brawl/src/game/tiled/`. Aucune dépendance moteur (au plus `@atlasjs/math`).

### 5.1 Résolution des gid

```ts
const FLIP_H: number = 0x80000000;
const FLIP_V: number = 0x40000000;
const FLIP_D: number = 0x20000000;
const GID_MASK: number = 0x1fffffff; // ~(FLIP_H | FLIP_V | FLIP_D)

function resolveGid(raw: number): { gid: number; flipX: boolean; flipY: boolean } {
  const u: number = raw >>> 0;                 // non-signé 32 bits (obligatoire : les flags rendent le nombre "négatif")
  return {
    gid: u & GID_MASK,
    flipX: (u & FLIP_H) !== 0,
    flipY: (u & FLIP_V) !== 0,
  };
}
```

Le flip **diagonal** (`FLIP_D`, rotation) est masqué pour ne pas corrompre l'index, mais **non appliqué** en v1 (rare en top-down orthogonal → backlog).

Puis, pour une cellule non-vide (`gid !== 0`) : trouver le tileset tel que `firstGid <= gid <= firstGid + tileCount - 1`, et calculer l'index Atlas **avec row-flip** (voir ci-dessous).

**⚠️ Le row-flip Tiled↔Atlas est OBLIGATOIRE (piège vérifié en vrai) :** Tiled numérote les tuiles d'un tileset **top→bottom** (id local 0 = coin **haut-gauche**), alors que le rendu Atlas les adresse **bottom→top** (index 0 = coin **bas-gauche**). L'id local Tiled et l'index linéaire du `TileSet` gameplay **ne coïncident donc PAS** : il faut re-flipper la ligne. Avec `local = gid - firstGid`, `col = local % columns`, `tiledRow = floor(local / columns)`, `rows = tileCount / columns` :

`localIndex = (rows - 1 - tiledRow) * columns + col`

Le proto d'origine faisait bien ce flip (`getId(1) → {x:0, y:7}` pour grass 8×8 → index 56) mais avec `columns` comme base au lieu de `rows` (correct seulement pour un tileset **carré**). On utilise `rows` (dérivé de `tileCount/columns`), qu'on passe aussi à `TileSetAsset.fromPath` pour que le compte du `TileSet` gameplay fasse autorité.

### 5.2 Modèle résolu (types)

```ts
export interface ResolvedTileset {
  readonly name: string;         // nom d'affichage Tiled (logs)
  readonly image: string;        // champ `image` du JSON (clé de résolution d'URL, §6)
  readonly firstGid: number;
  readonly columns: number;
  readonly tileCount: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly spacing: number;      // défaut 0
  readonly margin: number;       // défaut 0
}

export interface ResolvedCell {
  readonly cx: number;
  readonly cy: number;
  readonly tileset: ResolvedTileset;
  readonly localIndex: number;
  readonly flipX: boolean;
  readonly flipY: boolean;
}

export interface ResolvedTileLayer {
  readonly name: string;
  readonly groupPath: readonly string[];   // ex. ["ground"]
  readonly order: number;                  // rang d'empilement global (bas → haut)
  readonly cells: readonly ResolvedCell[]; // cellules non-vides uniquement
}

export interface ObjectBase {
  readonly name: string;
  readonly x: number;            // pixels Tiled, NON scalés
  readonly y: number;
  readonly groupPath: readonly string[];
  readonly properties: Readonly<Record<string, unknown>>;
}
export interface PointObject extends ObjectBase { readonly kind: "point"; }
export interface TileObject extends ObjectBase {
  readonly kind: "tile";
  readonly tileset: ResolvedTileset;
  readonly localIndex: number;
  readonly flipX: boolean;
  readonly flipY: boolean;
  readonly width: number;        // pixels Tiled
  readonly height: number;
}
export interface RectObject extends ObjectBase {
  readonly kind: "rect";
  readonly width: number;
  readonly height: number;
}
export type ResolvedObject = PointObject | TileObject | RectObject;
```

**Convention d'ancre Tiled (piège classique) :** un objet **tile** est ancré **bottom-left** (`y` = bas) ; un objet **rectangle/point** est ancré **top-left**. `TiledDocument` conserve les valeurs brutes ; c'est `MapBuilder` qui applique l'ancre + le scale (§7).

### 5.3 API

```ts
export class TiledDocument {
  public constructor(json: unknown);   // parse-only, pas de resolver ici
  public readonly width: number;       // en cellules
  public readonly height: number;
  public readonly tileWidth: number;
  public readonly tileHeight: number;
  public get tilesets(): readonly ResolvedTileset[];    // seulement ceux avec une image
  public get tileLayers(): readonly ResolvedTileLayer[];
  public get objects(): readonly ResolvedObject[];
}
```

Internes : le parsing aplatit récursivement les `group`, garde l'ordre d'empilement (`order`), skippe les tilesets sans `image` (et logue si une cellule référence un gid non résolu). Les anciens `LayerManager`/`TileSetManager`/`MapObjectManager`/`MapObjectBuilder` fusionnent ici (ou deviennent des helpers privés).

## 6. Hook app — `TiledAssetResolver`

**Problème Vite.** Le champ `image` du JSON (`"../assets/tilesets/ground/grass-tileset.png"`) est un string runtime, pas un module. Vite ne réécrit une URL bundlée/hashée que depuis un **import statique** → un string brut donne un 404 en prod. L'app doit donc traduire `image → URL bundlée`.

```ts
export type TiledAssetResolver = (tileset: ResolvedTileset) => string | undefined;
```

**Implémentation retenue (app) — `import.meta.glob` eager :**

```ts
export function createGlobTilesetResolver(): TiledAssetResolver {
  const modules: Record<string, string> = import.meta.glob(
    "../../assets/tilesets/**/*.png",   // littéral statique (contrainte Vite)
    { eager: true, import: "default" },
  ) as Record<string, string>;

  // index par sous-chemin de fin normalisé, pour matcher le `image` du JSON
  return (tileset: ResolvedTileset): string | undefined => {
    const wanted: string = normalizeTail(tileset.image); // ex. "tilesets/ground/grass-tileset.png"
    // match sur le plus long suffixe commun unique ; fallback basename ; warn si ambigu/absent
    return findByTail(modules, wanted);
  };
}
```

- ✅ **Zéro maintenance** : ajouter un tileset dans Tiled + poser le PNG → résolu automatiquement.
- On matche sur `image` (lié au fichier disque), **pas** sur `name` (nom d'affichage éditable).
- `test` (`image: null`) est déjà écarté par `TiledDocument` → le resolver n'est jamais appelé dessus.
- Fallback : une table explicite `{ "grass-tileset.png": Grass, ... }` reste possible si un remapping manuel est un jour nécessaire.

`MapBuilder` construit, pour chaque `ResolvedTileset`, un `TileSetAsset.fromPath(resolver(ts)!, { tileWidth, tileHeight, columns: ts.columns, spacing: ts.spacing, margin: ts.margin })` puis `assets.load<TileSet>(...)` (dedup gratuit).

## 7. Couche 2 — `MapBuilder` (instanciation ECS)

```ts
export interface MapBuilderOptions {
  readonly resolver: TiledAssetResolver;
  readonly scale: number;                                  // = MAP_SCALE
  readonly resolveSortingLayer: (layer: { name: string; groupPath: readonly string[] }) => string;
  readonly objectSortingLayer?: string;                    // défaut "Entities"
}

export interface MapCollider {
  readonly name: string;
  readonly x: number;      // coin haut-gauche, coords MONDE (× scale)
  readonly y: number;
  readonly width: number;  // × scale
  readonly height: number;
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface BuiltMap {
  readonly grid: Entity;
  readonly tileLayers: readonly Entity[];                  // enfants TileMap (splittés)
  readonly objectEntities: readonly Entity[];              // sprites des tile-objects
  readonly colliders: readonly MapCollider[];              // data-only
  readonly points: Readonly<Record<string, PointObject>>;  // marqueurs (coords MONDE)
}

export class MapBuilder {
  public static async build(
    ctx: SceneContext,
    doc: TiledDocument,
    options: MapBuilderOptions,
  ): Promise<BuiltMap>;
}
```

**Grille.** Une entité `Grid` (racine) avec `Transform2D` scalé par `scale`, `cellSize = new Vec2(doc.tileWidth, doc.tileHeight)`. Chaque calque est un enfant (`setParent`).

**Calques de tuiles (split multi-tileset).** Pour chaque `ResolvedTileLayer`, on groupe ses cellules par `tileset`, et pour chaque tileset utilisé on crée un enfant : `TileMap(tileset gameplay)` + `TileMapRenderer` (`sortingLayer = resolveSortingLayer(layer)`, `sortingOrder = layer.order`) + `Transform2D` (identité) parenté à la `Grid`. On remplit via `setTile(cx, cy, localIndex)`. → **un draw call instancié par (calque × tileset)**.

**Tile-objects.** Pour chaque `TileObject` : entité avec `Transform2D` + `SpriteRenderer(sprite)` où `sprite` provient du `TileSet` gameplay (`getTile(localIndex).sprite`), **pivot bas** de sorte que `worldY` = la base (les pieds). Position monde = ancre bottom-left Tiled × `scale`. `sortingLayer = objectSortingLayer` (`Entities`, ySort). `flipX/flipY` reportés sur `SpriteRender`. C'est ce qui fait passer le joueur devant/derrière.

> *Détail d'implémentation* (à trancher dans le plan) : le pivot bas se fait soit via un `SpriteAsset` par-objet (même texture+rect, `pivot` bas), soit en compensant le pivot du tileset par un offset de transform. La cible visuelle : base du sprite ancrée au point Tiled, `worldY` = base.

**Rect-objects.** Aucune entité. Poussés dans `BuiltMap.colliders` en coords **monde** : `{ x: obj.x*scale, y: obj.y*scale, width: obj.width*scale, height: obj.height*scale, name, properties }` (ancre top-left Tiled). Consommés par le feature *tilemap collision* pour spawner les `Collider2D` occludeurs.

**Point-objects.** Aucune entité. Exposés dans `BuiltMap.points` en coords **monde** (× scale) — clé = `name`.

## 8. Politique de sorting

`resolveSortingLayer(layer)` est **fourni par l'app** (MapBuilder reste policy-free). Le module `tiled/` livre un helper implémentant la convention retenue :

```ts
export function groupNameSortingResolver(
  knownLayers: readonly string[],                 // les noms passés à sortingLayers.define(...)
  opts?: { override?: Record<string, string>; fallback?: string },
): (layer: { name: string; groupPath: readonly string[] }) => string;
```

Règle (dans l'ordre) :
1. `override[layer.name]` si présent.
2. Sinon, on parcourt `groupPath` de l'intérieur vers l'extérieur ; le premier nom qui matche (case-insensitive) un `knownLayers` gagne. → un groupe `ground` route vers `Ground`.
3. Sinon `fallback` (défaut `"Default"`) + `logger.warn`.

Les **tile-objects** n'utilisent pas cette résolution : ils vont dans `objectSortingLayer` (`Entities`).

**Deux invariants à retenir :**
- Dans une couche `ySorted`, la convention n'assigne *que* la couche ; l'ordre **interne** vient du `worldY`, pas de `layer.order` (qui ne compte que pour les couches `manual`).
- **Le ySort est par-entité, pas par-tuile.** Un `TileMap` entier partage un seul `worldY`. Donc tout ce qui doit s'intercaler avec le joueur (occludeurs) **doit** être un tile-*object* (entité individuelle), jamais un calque de tuiles. C'est la raison de fond du modèle « arbres = objets ».

*Évolution v2* : lire une custom property `sortingLayer` par calque directement dans Tiled (la map se décrit toute seule) — repoussé faute de custom properties dans le JSON actuel.

## 9. Migration du code existant

**Supprimés :**
- `TileMapBuilderScript` (le `MapBuilder` remplit les `TileMap` directement, plus de script par calque).
- `SerializedTile` / `MapLoader.getSerializedLayer` (remplacés par le modèle résolu).
- Le hardcode de `spawnProps` : sa partie **visuelle** (arbres) devient des tile-objects Tiled ; sa partie **collision** devient des rect-objects → `BuiltMap.colliders` (consommés plus tard). `spawnProps` disparaît une fois les arbres passés dans la map.

**Réécrits :**
- `spawnWorld(ctx)` : construit le `resolver` (`createGlobTilesetResolver`) + le `resolveSortingLayer` (`groupNameSortingResolver([...])`), instancie `new TiledDocument(ResourcesPath.Map)`, appelle `await MapBuilder.build(ctx, doc, options)`, et retourne / stocke le `BuiltMap`.
- `ArenaScene` : lit `builtMap.points["spawn_point"]` (déjà en coords monde → **plus** de `.mult(MAP_SCALE)`).

**Refondus** dans `TiledDocument` : `MapLoader`, `LayerManager`, `TileSetManager`, `MapObjectManager`, `MapObjectBuilder`, `Layer`, `TileSet` (côté Tiled), `map.types`.

## 10. Bugs du proto corrigés

| Bug proto | Correction |
| --- | --- |
| `TileSet.getId` faisait le row-flip avec `columns` comme base → faux pour un tileset **non carré** | Row-flip **conservé** (il est nécessaire, cf. §5.1) mais basé sur `rows = tileCount/columns` + `rows` passé à `TileSetAsset` |
| gid non masqué → casse dès qu'une tuile est retournée dans Tiled | Masquage des 3 bits de flip + `flipX/flipY` exposés |
| Hypothèse « 1 tileset Tiled = 1 calque gameplay », matché par nom | Split multi-tileset par calque (§7) |
| Câblage manuel de chaque calque dans `spawnWorld` | Walk data-driven de l'arbre JSON |
| Chemin d'image du JSON ignoré (tileset hardcodé côté app) | `resolver` `import.meta.glob` matché sur `image` (§6) |

## 11. Stratégie de test

- **`TiledDocument` (unitaire, sans GPU)** : masquage flip-flags (`flipX/flipY`, `gid` masqué) ; `localIndex` **row-flippé** (grass gid 1 8×8 → 56, props gid 65 16×16 → 240) ; sélection du bon tileset par plage `firstGid..lastGid` ; multi-tileset dans un même calque ; aplatissement des groupes + `groupPath`/`order` ; objets typés (point/tile/rect) + ancres ; **skip** d'un tileset sans image ; warn sur gid non résolu.
- **`groupNameSortingResolver` (unitaire)** : override prioritaire ; match case-insensitive sur `groupPath` ; fallback + warn.
- **`MapBuilder` (intégration ECS via la harness gameplay)** : `Grid` montée + scalée ; split multi-tileset → N `TileMap` ; `setTile` aux bonnes coords ; tile-object → entité `SpriteRenderer` en `Entities`, ancrée base ; `colliders` en coords monde scalées (ancre top-left) ; `points` en coords monde ; `sortingOrder` = `layer.order` pour les couches manual.
- **Vérif navigateur (obligatoire)** : la map rend comme avant (ground + props), les arbres (tile-objects) s'intercalent avec le joueur (devant/derrière) selon `worldY`, un draw call par (calque × tileset). Rappels pièges : `import type` pour tout symbole type-only (sinon `tsc` passe mais Vite casse au runtime → écran noir) ; le dev server sert parfois une scène stale (restart si besoin).

## 12. Non-objectifs / backlog

Report explicite : spawn de colliders (data-only ici) ; solidité des calques de tuiles ; collision par-tuile ; custom properties typées ; sorting via custom property `sortingLayer` ; layouts iso/hex ; animation de tuiles Tiled ; extraction en package moteur `@atlasjs/tiled` (le seam `resolver`/`resolveSortingLayer` est déjà prêt pour ça).
