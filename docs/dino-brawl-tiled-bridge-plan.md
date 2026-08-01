# Bridge Tiled → Atlas (dino-brawl) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre le proto Tiled de `apps/dino-brawl` en un bridge data-driven propre : un `TiledDocument` (parse pur) + un `MapBuilder` (instanciation ECS) qui construit grille, calques de tuiles et objets à partir de l'export JSON de Tiled.

**Architecture:** Deux couches app-local. `TiledDocument` parse le JSON en modèle typé résolu (gid → `{tileset, localIndex, flip}`, calques aplatis, objets typés), sans dépendance moteur. `MapBuilder` charge les tilesets via l'`AssetManager`, crée `Grid` + `TileMap` (splittés par tileset), les entités-sprites des tile-objects (ySortées), et expose les rectangles de collision en data. Deux seams injectés par l'app : un resolver d'assets (`import.meta.glob`, contrainte Vite) et une politique de sorting par nom de groupe.

**Tech Stack:** TypeScript, Vitest, Vite, `@atlasjs/gameplay` (Grid/TileMap/TileMapRenderer/SpriteRenderer/TileSet/Sprite/sorting layers), `@atlasjs/nexus` (ECS), `@atlasjs/assets` (AssetManager), `@atlasjs/math` (Vec2).

**Design de référence :** [`docs/dino-brawl-tiled-bridge.md`](dino-brawl-tiled-bridge.md).

> **⚠️ Correction post-implémentation (row-flip Tiled↔Atlas).** Ce plan affirmait à tort que l'index local Tiled == l'index linéaire Atlas « sans flip ». **Faux** : Tiled numérote un tileset top→bottom, Atlas bottom→top → un **row-flip** est obligatoire. Le vrai mapping (appliqué dans le code final, corrigé après browser-verify) est `localIndex = (rows-1 - tiledRow)*columns + col` avec `rows = tileCount/columns`, et `rows` est passé à `TileSetAsset.fromPath`. Voir le spec §5.1 (corrigé). Les blocs de code et assertions `localIndex` ci-dessous (Task 2 / Task 5) montrent l'ancienne valeur non-flippée et sont **obsolètes** sur ce point — se référer au code committé + au spec.

## Global Constraints

- **App-local uniquement.** Tout le code vit dans `apps/dino-brawl/` — aucune modification des packages `@atlasjs/*`.
- **Collision = data-only.** Aucun `Collider2D`/`RigidBody2D` n'est spawné par le bridge ; les rectangles sont exposés en data (`BuiltMap.colliders`, coords monde).
- **Typage strict.** Tout est typé, même trivial (params, variables, champs). Pas de commentaires ajoutés.
- **Piège Vite (vérifié) :** dans les fichiers app, tout symbole *type-only* doit être importé via `import type` — sinon `tsc` passe mais Vite casse au runtime (écran noir). Les valeurs runtime (tokens `NEXUS`/`ASSET_MANAGER`, classes de composants, `Vec2`…) restent en import valeur.
- **Commits.** Par cadence projet, **l'utilisateur review et commit chaque task**. Les steps « Stage & commit » fournissent le `git add` + le message conventionnel ; ne pas committer sans review de l'utilisateur.
- **Commande de test** (depuis la racine du repo) : `pnpm --filter dino-brawl exec vitest run <chemin>` (ajouter `-t "<nom>"` pour un test précis).
- **Commande de typecheck** : `pnpm --filter dino-brawl exec tsc --noEmit -p tsconfig.app.json` (jamais `tsc -b` pour vérifier).

---

## File Structure

**Créés (`apps/dino-brawl/src/game/tiled/`) :**
- `gid.ts` — masquage flip-flags + `resolveGid` (pur).
- `resolved.types.ts` — modèle résolu (`ResolvedTileset`, `ResolvedCell`, `ResolvedTileLayer`, objets typés).
- `tiled.raw.types.ts` — types JSON bruts que `TiledDocument` parse, **isolés** du legacy `tiled.types.ts` (garde chaque commit vert : les fichiers legacy compilent jusqu'à leur suppression en Task 6).
- `TiledDocument.ts` — le parser (JSON brut → modèle résolu).
- `TiledAssetResolver.ts` — type `TiledAssetResolver` + `matchAssetByTail` (pur) + `createGlobTilesetResolver` (wrapper Vite).
- `sorting.ts` — `groupNameSortingResolver` (pur).
- `mapMath.ts` — helpers purs de layout (`groupCellsByTileset`, `colliderFromRect`, `worldPointFromObject`, `tileObjectPlacement`) + types `MapCollider`, `WorldPoint`.
- `MapBuilder.ts` — `MapBuilder.build` (ECS) + types `MapBuilderOptions`, `BuiltMap`.

**Modifiés :**
- `tiled/index.ts` — nouveau barrel.
- `spawn/spawnWorld.ts` — réécrit autour de `MapBuilder`.
- `game/ArenaScene.ts` — lit `builtMap.points`.
- `scripts/index.ts` — retrait de l'export `TileMapBuilderScript`.

**Supprimés :**
- `tiled/{MapLoader,LayerManager,Layer,TileSet,TileSetManager,MapObject,MapObjectManager,MapObjectBuilder,map.types,tiled.types}.ts` (legacy `tiled.types.ts` supprimé en Task 6 avec ses consommateurs)
- `scripts/TileMapBuilderScript.ts`
- `test/tiled/TileSet.test.ts`

**Hors périmètre (follow-up manuel dans l'éditeur Tiled, cf. handoff) :** retirer `spawn/spawnProps.ts` et migrer les 2 arbres hardcodés en tile-objects Tiled. `spawnProps` reste inchangé pour ne pas régresser la scène ; les chemins de code tile-object/rect sont couverts par des fixtures de test.

---

## Task 1 : `resolveGid` — masquage des flip-flags

**Files:**
- Create: `apps/dino-brawl/src/game/tiled/gid.ts`
- Test: `apps/dino-brawl/test/tiled/gid.test.ts`

**Interfaces:**
- Produces:
  - `const GID_MASK: number`, `FLIP_H: number`, `FLIP_V: number`, `FLIP_D: number`
  - `interface ResolvedGid { readonly gid: number; readonly flipX: boolean; readonly flipY: boolean }`
  - `function resolveGid(raw: number): ResolvedGid`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// apps/dino-brawl/test/tiled/gid.test.ts
import { describe, expect, it } from "vitest";

import { resolveGid } from "../../src/game/tiled/gid";

describe("resolveGid", () => {
  it("passes plain gids through untouched", () => {
    expect(resolveGid(1)).toEqual({ gid: 1, flipX: false, flipY: false });
    expect(resolveGid(65)).toEqual({ gid: 65, flipX: false, flipY: false });
    expect(resolveGid(0)).toEqual({ gid: 0, flipX: false, flipY: false });
  });

  it("masks the horizontal flip flag (bit 31)", () => {
    expect(resolveGid(0x80000002)).toEqual({ gid: 2, flipX: true, flipY: false });
  });

  it("masks the vertical flip flag (bit 30)", () => {
    expect(resolveGid(0x40000003)).toEqual({ gid: 3, flipX: false, flipY: true });
  });

  it("masks combined flip flags including the diagonal (bit 29)", () => {
    expect(resolveGid(0xe0000004)).toEqual({ gid: 4, flipX: true, flipY: true });
  });
});
```

- [ ] **Step 2 : Lancer le test → échec**

Run: `pnpm --filter dino-brawl exec vitest run test/tiled/gid.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/game/tiled/gid"` / `resolveGid is not a function`.

- [ ] **Step 3 : Implémenter le minimum**

```ts
// apps/dino-brawl/src/game/tiled/gid.ts
export const FLIP_H: number = 0x80000000;
export const FLIP_V: number = 0x40000000;
export const FLIP_D: number = 0x20000000;
export const GID_MASK: number = 0x1fffffff;

export interface ResolvedGid {
  readonly gid: number;
  readonly flipX: boolean;
  readonly flipY: boolean;
}

export function resolveGid(raw: number): ResolvedGid {
  const u: number = raw >>> 0;
  return {
    gid: u & GID_MASK,
    flipX: (u & FLIP_H) !== 0,
    flipY: (u & FLIP_V) !== 0,
  };
}
```

- [ ] **Step 4 : Lancer le test → succès**

Run: `pnpm --filter dino-brawl exec vitest run test/tiled/gid.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5 : Stage & commit** (l'utilisateur review et commit)

```bash
git add apps/dino-brawl/src/game/tiled/gid.ts apps/dino-brawl/test/tiled/gid.test.ts
git commit -m "feat(dino-brawl): add Tiled gid resolution with flip-flag masking"
```

---

## Task 2 : `TiledDocument` — parse du JSON en modèle résolu

**Files:**
- Create: `apps/dino-brawl/src/game/tiled/resolved.types.ts`
- Create: `apps/dino-brawl/src/game/tiled/TiledDocument.ts`
- Create: `apps/dino-brawl/src/game/tiled/tiled.raw.types.ts` (types JSON bruts ; le legacy `tiled.types.ts` reste **intact**)
- Test: `apps/dino-brawl/test/tiled/TiledDocument.test.ts`

**Interfaces:**
- Consumes: `resolveGid` (Task 1).
- Produces (dans `resolved.types.ts`) :
  - `ResolvedTileset { name; image; firstGid; columns; tileCount; tileWidth; tileHeight; spacing; margin }` (tous `readonly`)
  - `ResolvedCell { cx; cy; tileset: ResolvedTileset; localIndex; flipX; flipY }`
  - `ResolvedTileLayer { name; groupPath: readonly string[]; order; cells: readonly ResolvedCell[] }`
  - `ObjectBase { name; x; y; groupPath: readonly string[]; properties: Readonly<Record<string, unknown>> }`
  - `PointObject extends ObjectBase { kind: "point" }`
  - `TileObject extends ObjectBase { kind: "tile"; tileset: ResolvedTileset; localIndex; flipX; flipY; width; height }`
  - `RectObject extends ObjectBase { kind: "rect"; width; height }`
  - `type ResolvedObject = PointObject | TileObject | RectObject`
  - Classe `TiledDocument` : `constructor(json: unknown)`, `readonly width/height/tileWidth/tileHeight: number`, getters `tilesets`, `tileLayers`, `objects`.

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// apps/dino-brawl/test/tiled/TiledDocument.test.ts
import { describe, expect, it } from "vitest";

import { TiledDocument } from "../../src/game/tiled/TiledDocument";
import type { RectObject, PointObject, TileObject } from "../../src/game/tiled/resolved.types";

const fixture = {
  width: 2,
  height: 2,
  tilewidth: 32,
  tileheight: 32,
  tilesets: [
    { name: "grass", firstgid: 1, columns: 8, tilecount: 64, tilewidth: 32, tileheight: 32, image: "../assets/tilesets/ground/grass-tileset.png" },
    { name: "props", firstgid: 65, columns: 16, tilecount: 256, tilewidth: 32, tileheight: 32, image: "../assets/tilesets/props/props.png" },
    { name: "test", firstgid: 321, columns: 0, tilecount: 1, tilewidth: 160, tileheight: 160, image: null },
  ],
  layers: [
    {
      type: "group",
      name: "ground",
      layers: [
        { type: "tilelayer", name: "ground_layer", data: [1, 65, 0, 0x80000002] },
      ],
    },
    {
      type: "group",
      name: "systems",
      layers: [
        {
          type: "objectgroup",
          name: "systems_objects",
          objects: [
            { id: 1, name: "spawn_point", x: 48, y: 32, width: 0, height: 0, point: true },
            { id: 2, name: "tree", x: 64, y: 96, width: 32, height: 32, gid: 65 },
            { id: 3, name: "wall", x: 10, y: 20, width: 40, height: 8 },
          ],
        },
      ],
    },
  ],
};

describe("TiledDocument tilesets", () => {
  it("keeps only tilesets that have an image", () => {
    const doc = new TiledDocument(fixture);
    expect(doc.tilesets.map((t) => t.name)).toEqual(["grass", "props"]);
    expect(doc.tilesets[0]).toMatchObject({ firstGid: 1, columns: 8, tileCount: 64, spacing: 0, margin: 0 });
  });
});

describe("TiledDocument tile layers", () => {
  it("flattens groups and records the group path + stacking order", () => {
    const doc = new TiledDocument(fixture);
    expect(doc.tileLayers).toHaveLength(1);
    expect(doc.tileLayers[0]).toMatchObject({ name: "ground_layer", groupPath: ["ground"], order: 0 });
  });

  it("resolves gids across multiple tilesets and drops empty cells", () => {
    const doc = new TiledDocument(fixture);
    const cells = doc.tileLayers[0].cells;
    expect(cells).toHaveLength(3);
    expect(cells[0]).toMatchObject({ cx: 0, cy: 0, localIndex: 0, flipX: false });
    expect(cells[0].tileset.name).toBe("grass");
    expect(cells[1]).toMatchObject({ cx: 1, cy: 0, localIndex: 0 });
    expect(cells[1].tileset.name).toBe("props");
    expect(cells[2]).toMatchObject({ cx: 1, cy: 1, localIndex: 1, flipX: true });
    expect(cells[2].tileset.name).toBe("grass");
  });
});

describe("TiledDocument objects", () => {
  it("types point / tile / rect objects and carries the group path", () => {
    const doc = new TiledDocument(fixture);
    const byName: Record<string, unknown> = Object.fromEntries(doc.objects.map((o) => [o.name, o]));

    const spawn = byName["spawn_point"] as PointObject;
    expect(spawn).toMatchObject({ kind: "point", x: 48, y: 32, groupPath: ["systems"] });

    const tree = byName["tree"] as TileObject;
    expect(tree).toMatchObject({ kind: "tile", localIndex: 0, width: 32, height: 32, x: 64, y: 96 });
    expect(tree.tileset.name).toBe("props");

    const wall = byName["wall"] as RectObject;
    expect(wall).toMatchObject({ kind: "rect", x: 10, y: 20, width: 40, height: 8 });
  });
});
```

- [ ] **Step 2 : Lancer le test → échec**

Run: `pnpm --filter dino-brawl exec vitest run test/tiled/TiledDocument.test.ts`
Expected: FAIL — import de `TiledDocument` / `resolved.types` non résolu.

- [ ] **Step 3 : Écrire les types résolus**

```ts
// apps/dino-brawl/src/game/tiled/resolved.types.ts
export interface ResolvedTileset {
  readonly name: string;
  readonly image: string;
  readonly firstGid: number;
  readonly columns: number;
  readonly tileCount: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly spacing: number;
  readonly margin: number;
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
  readonly groupPath: readonly string[];
  readonly order: number;
  readonly cells: readonly ResolvedCell[];
}

export interface ObjectBase {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly groupPath: readonly string[];
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface PointObject extends ObjectBase {
  readonly kind: "point";
}

export interface TileObject extends ObjectBase {
  readonly kind: "tile";
  readonly tileset: ResolvedTileset;
  readonly localIndex: number;
  readonly flipX: boolean;
  readonly flipY: boolean;
  readonly width: number;
  readonly height: number;
}

export interface RectObject extends ObjectBase {
  readonly kind: "rect";
  readonly width: number;
  readonly height: number;
}

export type ResolvedObject = PointObject | TileObject | RectObject;
```

- [ ] **Step 4 : Créer les types JSON bruts (isolés du legacy)**

Créer `apps/dino-brawl/src/game/tiled/tiled.raw.types.ts`. Le legacy `apps/dino-brawl/src/game/tiled/tiled.types.ts` reste **intact** (les 3 fichiers legacy — `MapLoader`/`TileSetManager`/`MapObjectBuilder` — continuent de compiler jusqu'à leur suppression en Task 6, ce qui garde chaque commit vert sous `tsc`) :

```ts
// apps/dino-brawl/src/game/tiled/tiled.raw.types.ts
export type TiledLayer = TiledGroupLayer | TiledTileLayer | TiledObjectGroup;

export interface TiledTileLayer {
  type: "tilelayer";
  name: string;
  data: number[];
}

export interface TiledGroupLayer {
  type: "group";
  name: string;
  layers: TiledLayer[];
}

export interface TiledObjectGroup {
  type: "objectgroup";
  name: string;
  objects: TiledObject[];
}

export interface TiledObject {
  id: number;
  name: string;
  type?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  point?: boolean;
  gid?: number;
  properties?: TiledProperty[];
}

export interface TiledProperty {
  name: string;
  type: string;
  value: unknown;
}

export interface TiledTileSet {
  name: string;
  columns: number;
  imagewidth?: number;
  imageheight?: number;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  firstgid: number;
  spacing?: number;
  margin?: number;
  image?: string | null;
}

export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTileSet[];
}
```

- [ ] **Step 5 : Implémenter `TiledDocument`**

```ts
// apps/dino-brawl/src/game/tiled/TiledDocument.ts
import { createLogger, Logger } from "@atlasjs/utils";

import { resolveGid } from "./gid";
import type {
  ResolvedCell,
  ResolvedObject,
  ResolvedTileLayer,
  ResolvedTileset,
} from "./resolved.types";
import type {
  TiledLayer,
  TiledMap,
  TiledObject,
  TiledProperty,
  TiledTileSet,
} from "./tiled.raw.types";

export class TiledDocument {
  public readonly width: number;
  public readonly height: number;
  public readonly tileWidth: number;
  public readonly tileHeight: number;

  private readonly logger: Logger;
  private readonly resolvedTilesets: ResolvedTileset[];
  private readonly resolvedLayers: ResolvedTileLayer[];
  private readonly resolvedObjects: ResolvedObject[];

  public constructor(json: unknown) {
    const map: TiledMap = json as TiledMap;
    this.logger = createLogger(TiledDocument.name);
    this.width = map.width;
    this.height = map.height;
    this.tileWidth = map.tilewidth;
    this.tileHeight = map.tileheight;

    this.resolvedTilesets = this.resolveTilesets(map.tilesets);
    this.resolvedLayers = [];
    this.resolvedObjects = [];
    this.walk(map.layers, []);
  }

  public get tilesets(): readonly ResolvedTileset[] {
    return this.resolvedTilesets;
  }

  public get tileLayers(): readonly ResolvedTileLayer[] {
    return this.resolvedLayers;
  }

  public get objects(): readonly ResolvedObject[] {
    return this.resolvedObjects;
  }

  private resolveTilesets(tilesets: TiledTileSet[]): ResolvedTileset[] {
    const result: ResolvedTileset[] = [];

    for (const ts of tilesets) {
      if (!ts.image) {
        this.logger.warn(`Tileset '${ts.name}' has no image; skipped.`);
        continue;
      }

      result.push({
        name: ts.name,
        image: ts.image,
        firstGid: ts.firstgid,
        columns: ts.columns,
        tileCount: ts.tilecount,
        tileWidth: ts.tilewidth,
        tileHeight: ts.tileheight,
        spacing: ts.spacing ?? 0,
        margin: ts.margin ?? 0,
      });
    }

    return result;
  }

  private tilesetForGid(gid: number): ResolvedTileset | undefined {
    return this.resolvedTilesets.find(
      (ts: ResolvedTileset) => gid >= ts.firstGid && gid < ts.firstGid + ts.tileCount,
    );
  }

  private walk(layers: TiledLayer[], groupPath: string[]): void {
    for (const layer of layers) {
      if (layer.type === "group") {
        this.walk(layer.layers, [...groupPath, layer.name]);
      } else if (layer.type === "tilelayer") {
        this.resolvedLayers.push(this.resolveTileLayer(layer.name, layer.data, groupPath));
      } else if (layer.type === "objectgroup") {
        for (const obj of layer.objects) {
          const resolved: ResolvedObject | undefined = this.resolveObject(obj, groupPath);
          if (resolved) {
            this.resolvedObjects.push(resolved);
          }
        }
      }
    }
  }

  private resolveTileLayer(
    name: string,
    data: number[],
    groupPath: string[],
  ): ResolvedTileLayer {
    const cells: ResolvedCell[] = [];

    for (let i: number = 0; i < data.length; i++) {
      const raw: number = data[i];
      if (raw === 0) {
        continue;
      }

      const { gid, flipX, flipY } = resolveGid(raw);
      const tileset: ResolvedTileset | undefined = this.tilesetForGid(gid);

      if (!tileset) {
        this.logger.warn(`No tileset for gid ${gid} in layer '${name}'; cell skipped.`);
        continue;
      }

      cells.push({
        cx: i % this.width,
        cy: Math.floor(i / this.width),
        tileset,
        localIndex: gid - tileset.firstGid,
        flipX,
        flipY,
      });
    }

    return { name, groupPath: [...groupPath], order: this.resolvedLayers.length, cells };
  }

  private resolveObject(obj: TiledObject, groupPath: string[]): ResolvedObject | undefined {
    if (obj.name.length === 0) {
      return undefined;
    }

    const base = {
      name: obj.name,
      x: obj.x,
      y: obj.y,
      groupPath: [...groupPath],
      properties: this.readProperties(obj.properties),
    };

    if (obj.point) {
      return { ...base, kind: "point" };
    }

    if (obj.gid !== undefined) {
      const { gid, flipX, flipY } = resolveGid(obj.gid);
      const tileset: ResolvedTileset | undefined = this.tilesetForGid(gid);

      if (!tileset) {
        this.logger.warn(`No tileset for object gid ${gid} ('${obj.name}'); skipped.`);
        return undefined;
      }

      return {
        ...base,
        kind: "tile",
        tileset,
        localIndex: gid - tileset.firstGid,
        flipX,
        flipY,
        width: obj.width,
        height: obj.height,
      };
    }

    return { ...base, kind: "rect", width: obj.width, height: obj.height };
  }

  private readProperties(props?: TiledProperty[]): Readonly<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    if (props) {
      for (const p of props) {
        result[p.name] = p.value;
      }
    }
    return result;
  }
}
```

- [ ] **Step 6 : Lancer le test → succès**

Run: `pnpm --filter dino-brawl exec vitest run test/tiled/TiledDocument.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7 : Stage & commit**

```bash
git add apps/dino-brawl/src/game/tiled/resolved.types.ts apps/dino-brawl/src/game/tiled/TiledDocument.ts apps/dino-brawl/src/game/tiled/tiled.types.ts apps/dino-brawl/test/tiled/TiledDocument.test.ts
git commit -m "feat(dino-brawl): parse Tiled JSON into a resolved TiledDocument model"
```

---

## Task 3 : `TiledAssetResolver` — résolution d'URL via `import.meta.glob`

**Files:**
- Create: `apps/dino-brawl/src/game/tiled/TiledAssetResolver.ts`
- Test: `apps/dino-brawl/test/tiled/TiledAssetResolver.test.ts`

**Interfaces:**
- Consumes: `ResolvedTileset` (Task 2).
- Produces:
  - `type TiledAssetResolver = (tileset: ResolvedTileset) => string | undefined`
  - `function matchAssetByTail(modules: Readonly<Record<string, string>>, image: string): string | undefined`
  - `function createGlobTilesetResolver(): TiledAssetResolver`

- [ ] **Step 1 : Écrire le test qui échoue** (on ne teste que le matcher pur)

```ts
// apps/dino-brawl/test/tiled/TiledAssetResolver.test.ts
import { describe, expect, it } from "vitest";

import { matchAssetByTail } from "../../src/game/tiled/TiledAssetResolver";

const modules: Record<string, string> = {
  "../../../assets/tilesets/ground/grass-tileset.png": "/hashed/grass.abc.png",
  "../../../assets/tilesets/props/props.png": "/hashed/props.def.png",
};

describe("matchAssetByTail", () => {
  it("matches a Tiled image path to the bundled URL by trailing path", () => {
    expect(matchAssetByTail(modules, "../assets/tilesets/ground/grass-tileset.png")).toBe("/hashed/grass.abc.png");
    expect(matchAssetByTail(modules, "../assets/tilesets/props/props.png")).toBe("/hashed/props.def.png");
  });

  it("returns undefined when no basename matches", () => {
    expect(matchAssetByTail(modules, "../assets/tilesets/none.png")).toBeUndefined();
  });

  it("disambiguates equal basenames by the longest matching tail", () => {
    const collide: Record<string, string> = {
      "../../../assets/tilesets/a/wall.png": "/hashed/a-wall.png",
      "../../../assets/tilesets/b/wall.png": "/hashed/b-wall.png",
    };
    expect(matchAssetByTail(collide, "../assets/tilesets/b/wall.png")).toBe("/hashed/b-wall.png");
  });
});
```

- [ ] **Step 2 : Lancer le test → échec**

Run: `pnpm --filter dino-brawl exec vitest run test/tiled/TiledAssetResolver.test.ts`
Expected: FAIL — `matchAssetByTail` non défini.

- [ ] **Step 3 : Implémenter**

```ts
// apps/dino-brawl/src/game/tiled/TiledAssetResolver.ts
import { createLogger, Logger } from "@atlasjs/utils";

import type { ResolvedTileset } from "./resolved.types";

export type TiledAssetResolver = (tileset: ResolvedTileset) => string | undefined;

const logger: Logger = createLogger("TiledAssetResolver");

function segments(path: string): string[] {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .filter((s: string) => s.length > 0 && s !== "." && s !== "..");
}

function commonTailLength(a: string[], b: string[]): number {
  let n: number = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) {
    n++;
  }
  return n;
}

export function matchAssetByTail(
  modules: Readonly<Record<string, string>>,
  image: string,
): string | undefined {
  const wanted: string[] = segments(image);
  let bestUrl: string | undefined;
  let bestScore: number = 0;
  let tie: boolean = false;

  for (const key of Object.keys(modules)) {
    const score: number = commonTailLength(segments(key), wanted);
    if (score === 0) {
      continue;
    }
    if (score > bestScore) {
      bestScore = score;
      bestUrl = modules[key];
      tie = false;
    } else if (score === bestScore) {
      tie = true;
    }
  }

  if (bestUrl === undefined) {
    return undefined;
  }
  if (tie) {
    logger.warn(`Ambiguous asset match for '${image}'; using the first best candidate.`);
  }
  return bestUrl;
}

export function createGlobTilesetResolver(): TiledAssetResolver {
  const modules: Record<string, string> = import.meta.glob(
    "../../../assets/tilesets/**/*.png",
    { eager: true, import: "default" },
  ) as Record<string, string>;

  return (tileset: ResolvedTileset): string | undefined => {
    const url: string | undefined = matchAssetByTail(modules, tileset.image);
    if (url === undefined) {
      logger.warn(`No bundled asset for tileset '${tileset.name}' (image '${tileset.image}').`);
    }
    return url;
  };
}
```

- [ ] **Step 4 : Lancer le test → succès**

Run: `pnpm --filter dino-brawl exec vitest run test/tiled/TiledAssetResolver.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5 : Stage & commit**

```bash
git add apps/dino-brawl/src/game/tiled/TiledAssetResolver.ts apps/dino-brawl/test/tiled/TiledAssetResolver.test.ts
git commit -m "feat(dino-brawl): resolve Tiled tileset images to bundled URLs via glob"
```

---

## Task 4 : `groupNameSortingResolver` — sorting par convention de nom de groupe

**Files:**
- Create: `apps/dino-brawl/src/game/tiled/sorting.ts`
- Test: `apps/dino-brawl/test/tiled/sorting.test.ts`

**Interfaces:**
- Produces:
  - `interface SortingLayerInput { readonly name: string; readonly groupPath: readonly string[] }`
  - `interface GroupNameSortingOptions { readonly override?: Readonly<Record<string, string>>; readonly fallback?: string }`
  - `function groupNameSortingResolver(knownLayers: readonly string[], opts?: GroupNameSortingOptions): (layer: SortingLayerInput) => string`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// apps/dino-brawl/test/tiled/sorting.test.ts
import { describe, expect, it } from "vitest";

import { groupNameSortingResolver } from "../../src/game/tiled/sorting";

describe("groupNameSortingResolver", () => {
  it("matches a group name to a known layer, case-insensitively", () => {
    const resolve = groupNameSortingResolver(["Ground", "Entities", "Overhead"], { fallback: "Default" });
    expect(resolve({ name: "ground_layer", groupPath: ["ground"] })).toBe("Ground");
    expect(resolve({ name: "props_layer", groupPath: ["ground"] })).toBe("Ground");
    expect(resolve({ name: "roof", groupPath: ["overhead"] })).toBe("Overhead");
  });

  it("walks the group path inner-to-outer and takes the first match", () => {
    const resolve = groupNameSortingResolver(["Ground", "Overhead"], { fallback: "Default" });
    expect(resolve({ name: "x", groupPath: ["overhead", "decor"] })).toBe("Overhead");
  });

  it("falls back when nothing matches", () => {
    const resolve = groupNameSortingResolver(["Ground"], { fallback: "Default" });
    expect(resolve({ name: "x", groupPath: ["nope"] })).toBe("Default");
    expect(resolve({ name: "x", groupPath: [] })).toBe("Default");
  });

  it("honours an explicit override by layer name", () => {
    const resolve = groupNameSortingResolver(["Ground", "Entities"], {
      override: { special: "Entities" },
      fallback: "Ground",
    });
    expect(resolve({ name: "special", groupPath: ["ground"] })).toBe("Entities");
  });
});
```

- [ ] **Step 2 : Lancer le test → échec**

Run: `pnpm --filter dino-brawl exec vitest run test/tiled/sorting.test.ts`
Expected: FAIL — `groupNameSortingResolver` non défini.

- [ ] **Step 3 : Implémenter**

```ts
// apps/dino-brawl/src/game/tiled/sorting.ts
export interface SortingLayerInput {
  readonly name: string;
  readonly groupPath: readonly string[];
}

export interface GroupNameSortingOptions {
  readonly override?: Readonly<Record<string, string>>;
  readonly fallback?: string;
}

export function groupNameSortingResolver(
  knownLayers: readonly string[],
  opts?: GroupNameSortingOptions,
): (layer: SortingLayerInput) => string {
  const canonical: Map<string, string> = new Map<string, string>();
  for (const name of knownLayers) {
    canonical.set(name.toLowerCase(), name);
  }

  const override: Readonly<Record<string, string>> = opts?.override ?? {};
  const fallback: string = opts?.fallback ?? "Default";

  return (layer: SortingLayerInput): string => {
    const overridden: string | undefined = override[layer.name];
    if (overridden !== undefined) {
      return overridden;
    }

    for (let i: number = layer.groupPath.length - 1; i >= 0; i--) {
      const match: string | undefined = canonical.get(layer.groupPath[i].toLowerCase());
      if (match !== undefined) {
        return match;
      }
    }

    return fallback;
  };
}
```

- [ ] **Step 4 : Lancer le test → succès**

Run: `pnpm --filter dino-brawl exec vitest run test/tiled/sorting.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5 : Stage & commit**

```bash
git add apps/dino-brawl/src/game/tiled/sorting.ts apps/dino-brawl/test/tiled/sorting.test.ts
git commit -m "feat(dino-brawl): resolve sorting layer from Tiled group name"
```

---

## Task 5 : `mapMath` — helpers purs de layout

**Files:**
- Create: `apps/dino-brawl/src/game/tiled/mapMath.ts`
- Test: `apps/dino-brawl/test/tiled/mapMath.test.ts`

**Interfaces:**
- Consumes: `ResolvedTileLayer`, `ResolvedCell`, `ResolvedTileset`, `TileObject`, `RectObject`, `PointObject` (Task 2), `Vec2` (`@atlasjs/math`).
- Produces:
  - `interface MapCollider { readonly name: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly properties: Readonly<Record<string, unknown>> }`
  - `interface WorldPoint { readonly name: string; readonly x: number; readonly y: number; readonly properties: Readonly<Record<string, unknown>> }`
  - `interface TilePlacement { readonly position: Vec2; readonly scale: Vec2 }`
  - `function groupCellsByTileset(layer: ResolvedTileLayer): Map<ResolvedTileset, ResolvedCell[]>`
  - `function colliderFromRect(obj: RectObject, scale: number): MapCollider`
  - `function worldPointFromObject(obj: PointObject, scale: number): WorldPoint`
  - `function tileObjectPlacement(obj: TileObject, scale: number): TilePlacement`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// apps/dino-brawl/test/tiled/mapMath.test.ts
import { describe, expect, it } from "vitest";

import {
  colliderFromRect,
  groupCellsByTileset,
  tileObjectPlacement,
  worldPointFromObject,
} from "../../src/game/tiled/mapMath";
import type { PointObject, RectObject, ResolvedTileLayer, ResolvedTileset, TileObject } from "../../src/game/tiled/resolved.types";

const grass: ResolvedTileset = { name: "grass", image: "g.png", firstGid: 1, columns: 8, tileCount: 64, tileWidth: 32, tileHeight: 32, spacing: 0, margin: 0 };
const props: ResolvedTileset = { name: "props", image: "p.png", firstGid: 65, columns: 16, tileCount: 256, tileWidth: 32, tileHeight: 32, spacing: 0, margin: 0 };

describe("groupCellsByTileset", () => {
  it("buckets a layer's cells by their tileset", () => {
    const layer: ResolvedTileLayer = {
      name: "l", groupPath: [], order: 0,
      cells: [
        { cx: 0, cy: 0, tileset: grass, localIndex: 0, flipX: false, flipY: false },
        { cx: 1, cy: 0, tileset: props, localIndex: 0, flipX: false, flipY: false },
        { cx: 2, cy: 0, tileset: grass, localIndex: 3, flipX: false, flipY: false },
      ],
    };
    const buckets = groupCellsByTileset(layer);
    expect(buckets.get(grass)).toHaveLength(2);
    expect(buckets.get(props)).toHaveLength(1);
  });
});

describe("colliderFromRect", () => {
  it("scales a Tiled rect (top-left anchored) into world coords", () => {
    const rect: RectObject = { kind: "rect", name: "wall", x: 10, y: 20, width: 40, height: 8, groupPath: [], properties: {} };
    expect(colliderFromRect(rect, 2)).toEqual({ name: "wall", x: 20, y: 40, width: 80, height: 16, properties: {} });
  });
});

describe("worldPointFromObject", () => {
  it("scales a Tiled point into world coords", () => {
    const point: PointObject = { kind: "point", name: "spawn_point", x: 48, y: 32, groupPath: [], properties: {} };
    expect(worldPointFromObject(point, 2)).toEqual({ name: "spawn_point", x: 96, y: 64, properties: {} });
  });
});

describe("tileObjectPlacement", () => {
  it("anchors the sprite base at the Tiled bottom-left point and scales it", () => {
    const tree: TileObject = { kind: "tile", name: "tree", x: 64, y: 96, width: 32, height: 32, tileset: props, localIndex: 0, flipX: false, flipY: false, groupPath: [], properties: {} };
    const placement = tileObjectPlacement(tree, 2);
    expect(placement.position.x).toBe(160);
    expect(placement.position.y).toBe(192);
    expect(placement.scale.x).toBe(2);
    expect(placement.scale.y).toBe(2);
  });
});
```

- [ ] **Step 2 : Lancer le test → échec**

Run: `pnpm --filter dino-brawl exec vitest run test/tiled/mapMath.test.ts`
Expected: FAIL — imports non résolus.

- [ ] **Step 3 : Implémenter**

```ts
// apps/dino-brawl/src/game/tiled/mapMath.ts
import { Vec2 } from "@atlasjs/math";

import type {
  PointObject,
  RectObject,
  ResolvedCell,
  ResolvedTileLayer,
  ResolvedTileset,
  TileObject,
} from "./resolved.types";

export interface MapCollider {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface WorldPoint {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface TilePlacement {
  readonly position: Vec2;
  readonly scale: Vec2;
}

export function groupCellsByTileset(layer: ResolvedTileLayer): Map<ResolvedTileset, ResolvedCell[]> {
  const buckets: Map<ResolvedTileset, ResolvedCell[]> = new Map<ResolvedTileset, ResolvedCell[]>();

  for (const cell of layer.cells) {
    const existing: ResolvedCell[] | undefined = buckets.get(cell.tileset);
    if (existing) {
      existing.push(cell);
    } else {
      buckets.set(cell.tileset, [cell]);
    }
  }

  return buckets;
}

export function colliderFromRect(obj: RectObject, scale: number): MapCollider {
  return {
    name: obj.name,
    x: obj.x * scale,
    y: obj.y * scale,
    width: obj.width * scale,
    height: obj.height * scale,
    properties: obj.properties,
  };
}

export function worldPointFromObject(obj: PointObject, scale: number): WorldPoint {
  return {
    name: obj.name,
    x: obj.x * scale,
    y: obj.y * scale,
    properties: obj.properties,
  };
}

export function tileObjectPlacement(obj: TileObject, scale: number): TilePlacement {
  const scaleX: number = (obj.width / obj.tileset.tileWidth) * scale;
  const scaleY: number = (obj.height / obj.tileset.tileHeight) * scale;
  const position: Vec2 = new Vec2((obj.x + obj.width / 2) * scale, obj.y * scale);
  return { position, scale: new Vec2(scaleX, scaleY) };
}
```

- [ ] **Step 4 : Lancer le test → succès**

Run: `pnpm --filter dino-brawl exec vitest run test/tiled/mapMath.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5 : Stage & commit**

```bash
git add apps/dino-brawl/src/game/tiled/mapMath.ts apps/dino-brawl/test/tiled/mapMath.test.ts
git commit -m "feat(dino-brawl): add pure layout helpers for the Tiled map builder"
```

---

## Task 6 : `MapBuilder` + rewiring + cleanup + vérif navigateur

Cette task assemble tout : le `MapBuilder` (glue ECS, vérifiée au navigateur — pas de test unitaire), la réécriture de `spawnWorld`/`ArenaScene`, la suppression du proto et le nouveau barrel.

**Files:**
- Create: `apps/dino-brawl/src/game/tiled/MapBuilder.ts`
- Rewrite: `apps/dino-brawl/src/game/tiled/index.ts`
- Rewrite: `apps/dino-brawl/src/game/spawn/spawnWorld.ts`
- Rewrite: `apps/dino-brawl/src/game/ArenaScene.ts`
- Modify: `apps/dino-brawl/src/game/scripts/index.ts`
- Delete: `apps/dino-brawl/src/game/tiled/{MapLoader,LayerManager,Layer,TileSet,TileSetManager,MapObject,MapObjectManager,MapObjectBuilder,map.types,tiled.types}.ts`
- Delete: `apps/dino-brawl/src/game/scripts/TileMapBuilderScript.ts`
- Delete: `apps/dino-brawl/test/tiled/TileSet.test.ts`

**Interfaces:**
- Consumes: `TiledDocument` (T2), `TiledAssetResolver` (T3), `SortingLayerInput` (T4), `MapCollider`/`WorldPoint`/`groupCellsByTileset`/`colliderFromRect`/`worldPointFromObject`/`tileObjectPlacement` (T5).
- Produces:
  - `interface MapBuilderOptions { readonly resolver: TiledAssetResolver; readonly scale: number; readonly resolveSortingLayer: (layer: SortingLayerInput) => string; readonly objectSortingLayer?: string }`
  - `interface BuiltMap { readonly grid: Entity; readonly tileLayers: readonly Entity[]; readonly objectEntities: readonly Entity[]; readonly colliders: readonly MapCollider[]; readonly points: Readonly<Record<string, WorldPoint>> }`
  - `class MapBuilder { static build(ctx: SceneContext, doc: TiledDocument, options: MapBuilderOptions): Promise<BuiltMap> }`
  - `spawnWorld(ctx: SceneContext): Promise<BuiltMap>` (signature changée : plus de param `mapLoader`, retourne le `BuiltMap`).

- [ ] **Step 1 : Implémenter `MapBuilder`**

```ts
// apps/dino-brawl/src/game/tiled/MapBuilder.ts
import { Vec2 } from "@atlasjs/math";
import type { SceneContext } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";
import { type AssetManager, ASSET_MANAGER } from "@atlasjs/assets";
import { createLogger, Logger } from "@atlasjs/utils";

import {
  type Sprite as SpriteType,
  type TileSet as TileSetType,
  Grid,
  Sprite,
  SpriteRenderer,
  TileMap,
  TileMapRenderer,
  TileSetAsset,
  Transform2D,
} from "@atlasjs/gameplay";

import type { TiledDocument } from "./TiledDocument";
import type { TiledAssetResolver } from "./TiledAssetResolver";
import type { SortingLayerInput } from "./sorting";
import type {
  PointObject,
  RectObject,
  ResolvedCell,
  ResolvedTileLayer,
  ResolvedTileset,
  TileObject,
} from "./resolved.types";
import {
  type MapCollider,
  type WorldPoint,
  colliderFromRect,
  groupCellsByTileset,
  tileObjectPlacement,
  worldPointFromObject,
} from "./mapMath";

export interface MapBuilderOptions {
  readonly resolver: TiledAssetResolver;
  readonly scale: number;
  readonly resolveSortingLayer: (layer: SortingLayerInput) => string;
  readonly objectSortingLayer?: string;
}

export interface BuiltMap {
  readonly grid: Entity;
  readonly tileLayers: readonly Entity[];
  readonly objectEntities: readonly Entity[];
  readonly colliders: readonly MapCollider[];
  readonly points: Readonly<Record<string, WorldPoint>>;
}

export class MapBuilder {
  public static async build(
    ctx: SceneContext,
    doc: TiledDocument,
    options: MapBuilderOptions,
  ): Promise<BuiltMap> {
    const logger: Logger = createLogger(MapBuilder.name);
    const nexus: NexusWorld = ctx.services.get(NEXUS);
    const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
    const objectLayer: string = options.objectSortingLayer ?? "Entities";

    const tilesets: Map<ResolvedTileset, TileSetType> = new Map<ResolvedTileset, TileSetType>();
    for (const ts of doc.tilesets) {
      const url: string | undefined = options.resolver(ts);
      if (url === undefined) {
        continue;
      }
      const asset: TileSetAsset = TileSetAsset.fromPath(url, {
        tileWidth: ts.tileWidth,
        tileHeight: ts.tileHeight,
        columns: ts.columns,
        spacing: ts.spacing,
        margin: ts.margin,
      });
      tilesets.set(ts, await assets.load<TileSetType>(asset));
    }

    const grid: Entity = nexus.createEntity();
    nexus.addComponent(grid, Transform2D).scale.set(options.scale, options.scale);
    nexus.addComponent(grid, Grid, new Vec2(doc.tileWidth, doc.tileHeight));

    const tileLayers: Entity[] = [];
    for (const layer of doc.tileLayers) {
      MapBuilder.buildTileLayer(nexus, grid, layer, tilesets, options, tileLayers, logger);
    }

    const objectEntities: Entity[] = [];
    const colliders: MapCollider[] = [];
    const points: Record<string, WorldPoint> = {};

    for (const obj of doc.objects) {
      if (obj.kind === "point") {
        const point: PointObject = obj;
        points[point.name] = worldPointFromObject(point, options.scale);
      } else if (obj.kind === "rect") {
        const rect: RectObject = obj;
        colliders.push(colliderFromRect(rect, options.scale));
      } else {
        const entity: Entity | undefined = MapBuilder.buildTileObject(nexus, obj, tilesets, objectLayer, options.scale);
        if (entity !== undefined) {
          objectEntities.push(entity);
        }
      }
    }

    return { grid, tileLayers, objectEntities, colliders, points };
  }

  private static buildTileLayer(
    nexus: NexusWorld,
    grid: Entity,
    layer: ResolvedTileLayer,
    tilesets: Map<ResolvedTileset, TileSetType>,
    options: MapBuilderOptions,
    out: Entity[],
    logger: Logger,
  ): void {
    const sortingLayer: string = options.resolveSortingLayer({ name: layer.name, groupPath: layer.groupPath });
    const buckets: Map<ResolvedTileset, ResolvedCell[]> = groupCellsByTileset(layer);

    for (const [resolvedTileset, cells] of buckets) {
      const tileset: TileSetType | undefined = tilesets.get(resolvedTileset);
      if (tileset === undefined) {
        logger.warn(`Layer '${layer.name}': tileset '${resolvedTileset.name}' unresolved; ${cells.length} cells skipped.`);
        continue;
      }

      const entity: Entity = nexus.createEntity();
      nexus.addComponent(entity, Transform2D);
      const tileMap: TileMap = nexus.addComponent(entity, TileMap, tileset);
      const renderer: TileMapRenderer = nexus.addComponent(entity, TileMapRenderer);
      renderer.sortingOrder = layer.order;
      renderer.sortingLayer = sortingLayer;
      nexus.setParent(entity, grid);

      for (const cell of cells) {
        tileMap.setTile(cell.cx, cell.cy, cell.localIndex);
      }

      out.push(entity);
    }
  }

  private static buildTileObject(
    nexus: NexusWorld,
    obj: TileObject,
    tilesets: Map<ResolvedTileset, TileSetType>,
    sortingLayer: string,
    scale: number,
  ): Entity | undefined {
    const tileset: TileSetType | undefined = tilesets.get(obj.tileset);
    if (tileset === undefined) {
      return undefined;
    }

    const base: SpriteType = tileset.getTile(obj.localIndex).sprite;
    const sprite: SpriteType = new Sprite(tileset.texture, { rect: base.rect, pivot: new Vec2(0.5, 1) });

    const placement = tileObjectPlacement(obj, scale);
    const entity: Entity = nexus.createEntity();
    const transform: Transform2D = nexus.addComponent(entity, Transform2D);
    transform.position.copyFrom(placement.position);
    transform.scale.copyFrom(placement.scale);

    const render = nexus.addComponent(entity, SpriteRenderer, sprite);
    render.sortingLayer = sortingLayer;
    render.flipX = obj.flipX;
    render.flipY = obj.flipY;

    return entity;
  }
}
```

> **Vérifs à faire pendant l'implémentation** (API réelle) : `Transform2D.position`/`.scale` sont des `Vec2` — confirmer `copyFrom` (utilisé dans le moteur ; sinon `.set(x, y)`). `Sprite` accepte `{ rect, pivot }` (cf. `packages/gameplay/src/assets/Sprite.ts`). `SpriteRenderer` est le token identité = `SpriteRender` (champs `flipX/flipY/sortingLayer/sortingOrder`). Garder les `import type` pour `SceneContext`, `NexusWorld`, `Entity` (type), `AssetManager` (type), `Sprite as SpriteType`, `TileSet as TileSetType`, `TiledDocument`, `TiledAssetResolver`, `SortingLayerInput`, et les types de `resolved.types`.

- [ ] **Step 2 : Réécrire le barrel `tiled/index.ts`**

```ts
// apps/dino-brawl/src/game/tiled/index.ts
export * from "./gid";
export * from "./resolved.types";
export * from "./tiled.raw.types";
export * from "./TiledDocument";
export * from "./TiledAssetResolver";
export * from "./sorting";
export * from "./mapMath";
export * from "./MapBuilder";
```

- [ ] **Step 3 : Réécrire `spawnWorld`**

```ts
// apps/dino-brawl/src/game/spawn/spawnWorld.ts
import type { SceneContext } from "@atlasjs/core";

import {
  type BuiltMap,
  MapBuilder,
  TiledDocument,
  createGlobTilesetResolver,
  groupNameSortingResolver,
} from "../tiled";
import { ResourcesPath } from "../ResourcesPath";
import { SortingLayer, MAP_SCALE } from "../config";

export async function spawnWorld(ctx: SceneContext): Promise<BuiltMap> {
  const doc: TiledDocument = new TiledDocument(ResourcesPath.Map);

  return MapBuilder.build(ctx, doc, {
    resolver: createGlobTilesetResolver(),
    scale: MAP_SCALE,
    resolveSortingLayer: groupNameSortingResolver(
      [SortingLayer.Ground, SortingLayer.Entities, SortingLayer.Overhead],
      { fallback: SortingLayer.Ground },
    ),
    objectSortingLayer: SortingLayer.Entities,
  });
}
```

- [ ] **Step 4 : Réécrire `ArenaScene` pour lire `builtMap.points`**

Remplacer, dans `apps/dino-brawl/src/game/ArenaScene.ts`, les imports Tiled et le corps de `onCreate` liés à la map :

```ts
// imports (haut du fichier) — retirer les imports de "./tiled" (MapLoader / PinObject)
import { Vec2 } from "@atlasjs/math";
import { type SceneContext, Scene } from "@atlasjs/core";

import { type SortingLayers, SORTING_LAYERS } from "@atlasjs/gameplay";

import type { BuiltMap, WorldPoint } from "./tiled";
import { ResourcesPath } from "./ResourcesPath";
import { SortingLayer } from "./config";
import { spawnCamera, spawnPlayer, spawnProps, spawnSword, spawnWorld } from "./spawn";
```

```ts
// dans onCreate, remplacer le bloc mapLoader + spawnWorld + spawn_point par :
    const sortingLayers: SortingLayers = ctx.services.get(SORTING_LAYERS);
    sortingLayers.define([
      { name: SortingLayer.Ground, mode: "manual" },
      { name: SortingLayer.Entities, mode: "ySorted" },
      { name: SortingLayer.Overhead, mode: "manual" },
    ]);

    const builtMap: BuiltMap = await spawnWorld(ctx);

    const spawn: WorldPoint | undefined = builtMap.points["spawn_point"];
    const spawnPosition: Vec2 = spawn ? Vec2.create(spawn.x, spawn.y) : Vec2.zero();

    const { player } = await spawnPlayer(ctx, spawnPosition);
    await spawnSword(ctx, player);
    await spawnProps(ctx, spawnPosition);
    spawnCamera(ctx, player);
```

> Note : `ResourcesPath` reste importé (utilisé par `spawnWorld` via `.Map`, et potentiellement ailleurs). `MAP_SCALE` n'est plus utilisé dans `ArenaScene` (les points sont déjà en coords monde) — retirer son import s'il devient inutilisé.

- [ ] **Step 5 : Retirer `TileMapBuilderScript` du barrel scripts**

Dans `apps/dino-brawl/src/game/scripts/index.ts`, supprimer la ligne exportant `TileMapBuilderScript`.

- [ ] **Step 6 : Supprimer le proto**

```bash
git rm apps/dino-brawl/src/game/tiled/MapLoader.ts \
       apps/dino-brawl/src/game/tiled/LayerManager.ts \
       apps/dino-brawl/src/game/tiled/Layer.ts \
       apps/dino-brawl/src/game/tiled/TileSet.ts \
       apps/dino-brawl/src/game/tiled/TileSetManager.ts \
       apps/dino-brawl/src/game/tiled/MapObject.ts \
       apps/dino-brawl/src/game/tiled/MapObjectManager.ts \
       apps/dino-brawl/src/game/tiled/MapObjectBuilder.ts \
       apps/dino-brawl/src/game/tiled/map.types.ts \
       apps/dino-brawl/src/game/tiled/tiled.types.ts \
       apps/dino-brawl/src/game/scripts/TileMapBuilderScript.ts \
       apps/dino-brawl/test/tiled/TileSet.test.ts
```

- [ ] **Step 7 : Typecheck + suite complète**

Run: `pnpm --filter dino-brawl exec tsc --noEmit -p tsconfig.app.json`
Expected: 0 erreur. (Si erreur « type-only import », corriger en `import type`.)

Run: `pnpm --filter dino-brawl exec vitest run`
Expected: PASS (gid + TiledDocument + TiledAssetResolver + sorting + mapMath). Aucune référence à l'ancien `TileSet.test.ts`.

- [ ] **Step 8 : Vérif navigateur (obligatoire)**

1. Démarrer le dev server via l'outil de preview (`preview_start` avec `{ name: "dino-brawl" }` ; créer `.claude/launch.json` si absent : `runtimeExecutable "pnpm"`, `runtimeArgs ["--filter","dino-brawl","dev"]`, `port 5173`).
2. `read_console_messages` + `preview_logs` → aucune erreur (pas de 404 d'asset, pas d'écran noir).
3. Screenshot : le sol (grass) + le calque props rendent comme avant ; le joueur spawn au `spawn_point`.
4. Déplacer le joueur (contrôles) et vérifier le tri Y avec les arbres (`spawnProps`) : le joueur passe **devant** quand il est plus bas, **derrière** quand il est plus haut.

> Rappels pièges (mémoire) : le pane WebGPU peut être lent/flaky et le HMR sert parfois une scène stale → **restart le dev server** au moindre doute. Si besoin d'inspecter les nodes, stasher via `window.__scene`.

- [ ] **Step 9 : Stage & commit**

```bash
git add apps/dino-brawl/src/game/tiled/MapBuilder.ts \
        apps/dino-brawl/src/game/tiled/index.ts \
        apps/dino-brawl/src/game/spawn/spawnWorld.ts \
        apps/dino-brawl/src/game/ArenaScene.ts \
        apps/dino-brawl/src/game/scripts/index.ts
git commit -m "feat(dino-brawl): build the scene from Tiled via MapBuilder, drop the proto"
```

---

## Self-Review (rempli par l'auteur du plan)

**1. Couverture du spec :**
- §5 `TiledDocument` (parse, flip, multi-tileset, skip image, objets typés) → Tasks 1 & 2. ✅
- §6 resolver `import.meta.glob` + match sur `image` → Task 3. ✅
- §7 `MapBuilder` (grille scalée, split multi-tileset, tile-objects ySortés ancrés base, rects data-only coords monde, points monde) + `BuiltMap` → Tasks 5 & 6. ✅
- §8 sorting par nom de groupe + override + fallback → Task 4 (+ câblage Task 6). ✅
- §9 migration (retrait `TileMapBuilderScript`/`SerializedTile`/`MapLoader`&co, réécriture `spawnWorld`/`ArenaScene`) → Task 6. ✅
- §10 bugs corrigés (flip-flags masqués, **row-flip Tiled↔Atlas** — voir la correction post-implémentation en tête —, multi-tileset, walk data-driven, resolver) → Tasks 1/2/3/5/6. ✅
- §11 tests (unitaires purs + vérif navigateur) → Tasks 1-6. ✅
- **Écart assumé vs §9** : `spawnProps` **n'est pas** supprimé (les 2 arbres restent hardcodés) pour ne pas régresser la scène ; la migration des arbres en tile-objects Tiled est un follow-up manuel dans l'éditeur. Signalé au handoff.

**2. Placeholders :** aucun `TODO`/`TBD` ; tout step de code montre le code complet.

**3. Cohérence des types :** `ResolvedTileset`/`ResolvedCell`/`ResolvedTileLayer`/`PointObject`/`TileObject`/`RectObject` (T2) réutilisés à l'identique en T5/T6 ; `MapCollider`/`WorldPoint` (T5) → `BuiltMap` (T6) ; `SortingLayerInput` (T4) → `MapBuilderOptions` (T6) ; `TiledAssetResolver` (T3) → `MapBuilderOptions` (T6). Signatures alignées.
