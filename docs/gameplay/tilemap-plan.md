# TileSet & TileMap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un système de tuiles façon Unity (`TileSet` asset + `Grid`/`TileMap`/`TileMapRenderer` ECS + rendu instancié), rempli code-first.

**Architecture:** Trois couches. (1) `TileSet` = asset (miroir de `Sprite`) découpant une texture en tuiles adressables par index. (2) Une entité `Grid` racine porte N entités-enfants `TileMap` (calques), chacune tenant ses cellules (`Map` éparse d'`int`) + son `TileMapRenderer`. (3) Un `TileMapNode` dédié dans nebula + un `NodeRenderer`/`Batcher` ; un `TileMapRenderSystem` côté gameplay traduit les cellules visibles en instances → un draw call instancié par calque.

**Tech Stack:** TypeScript strict, pnpm + Turborepo, Vitest, packages `@atlasjs/{gameplay,nebula,math,nexus,assets}`.

**Spec source:** [`tilemap.md`](tilemap.md).

## Global Constraints

- **Type everything**, même trivial (params de fonction, variables, champs de classe). Aucune inférence implicite laissée nue.
- **Aucun commentaire** dans le code.
- **Pas de dépendance circulaire** : `@atlasjs/nebula` ne doit **jamais** importer `@atlasjs/gameplay`. `TileMapNode`/`TileMapNodeRenderer` (nebula) ignorent `Tile`/`TileSet` (gameplay) — ils ne connaissent que texture / rect normalisé / instances.
- **Résolution cross-package = `dist`** (pas d'alias `src`). Après modification de `@atlasjs/nebula` (Tasks 6–7), **rebuild** (`pnpm --filter @atlasjs/nebula build`) avant tout test `@atlasjs/gameplay` qui importe les nouveaux symboles nebula (Tasks 8–10). Les tests purement gameplay (Tasks 1–5) ne nécessitent pas de rebuild nebula.
- **Cadence d'exécution** : subagent-driven, **une task à la fois** ; après chaque task **STOP** — l'utilisateur relit le diff et **committe lui-même** (ne pas auto-committer). Re-vérifier les tests de la task sur l'état committé.
- **Imports type-only** dans `apps/sandbox` : `import type` obligatoire pour les symboles utilisés seulement comme type (sinon `tsc` passe mais Vite casse au runtime → écran noir).
- Test runner : Vitest. Fichier unique : `pnpm --filter <pkg> exec vitest run test/<file>`. Suite complète d'un package : `pnpm --filter <pkg> test`. Typecheck gameplay : `pnpm --filter @atlasjs/gameplay run typecheck`. Compile nebula : `pnpm --filter @atlasjs/nebula build`.

---

## Task 1: `TileSet` + `Tile` (slicing & adressage)

**Files:**
- Create: `packages/gameplay/src/assets/Tile.ts`
- Create: `packages/gameplay/src/assets/TileSet.ts`
- Test: `packages/gameplay/test/tileset.test.ts`

**Interfaces:**
- Consumes: `Sprite` (`packages/gameplay/src/assets/Sprite.ts`), `Texture2D` (`@atlasjs/nebula`), `Bound`/`Vec2` (`@atlasjs/math`).
- Produces:
  - `class Tile { readonly index: number; readonly sprite: Sprite; constructor(index: number, sprite: Sprite) }`
  - `interface TileSetOptions { tileWidth: number; tileHeight: number; columns?: number; rows?: number; spacing?: number; margin?: number; pivot?: Vec2; id?: string }`
  - `class TileSet implements Resource { readonly id: string; readonly texture: Texture2D; readonly columns: number; readonly rows: number; get count(): number; getTile(index: number): Tile; tryGetTile(index: number): Tile | undefined; indexOf(col: number, row: number): number; destroy(): void; constructor(texture: Texture2D, options: TileSetOptions) }`

- [ ] **Step 1: Write the failing test**

```ts
// packages/gameplay/test/tileset.test.ts
import { describe, expect, it } from "vitest";
import { TileSet } from "../src/assets/TileSet";
import { Tile } from "../src/assets/Tile";
import { fakeTexture } from "./helpers/fakes";

describe("TileSet slicing", () => {
  it("slices a 256x256 texture into a 2x2 row-major grid of 128px tiles", () => {
    const set: TileSet = new TileSet(fakeTexture("grass", 256, 256), {
      tileWidth: 128,
      tileHeight: 128,
    });

    expect(set.columns).toBe(2);
    expect(set.rows).toBe(2);
    expect(set.count).toBe(4);

    const t0: Tile = set.getTile(0);
    expect(t0.index).toBe(0);
    expect(t0.sprite.rect.x).toBe(0);
    expect(t0.sprite.rect.y).toBe(0);
    expect(t0.sprite.rect.width).toBe(128);

    expect(set.getTile(1).sprite.rect.x).toBe(128);
    expect(set.getTile(1).sprite.rect.y).toBe(0);
    expect(set.getTile(2).sprite.rect.x).toBe(0);
    expect(set.getTile(2).sprite.rect.y).toBe(128);
    expect(set.getTile(3).sprite.rect.x).toBe(128);
    expect(set.getTile(3).sprite.rect.y).toBe(128);
  });

  it("maps (col,row) to a row-major linear index", () => {
    const set: TileSet = new TileSet(fakeTexture("t", 256, 256), {
      tileWidth: 128,
      tileHeight: 128,
    });

    expect(set.indexOf(0, 0)).toBe(0);
    expect(set.indexOf(1, 0)).toBe(1);
    expect(set.indexOf(0, 1)).toBe(2);
    expect(set.indexOf(1, 1)).toBe(3);
  });

  it("honours margin and spacing (padded atlas)", () => {
    const set: TileSet = new TileSet(fakeTexture("t", 260, 260), {
      tileWidth: 128,
      tileHeight: 128,
      spacing: 2,
      margin: 1,
    });

    expect(set.columns).toBe(2);
    expect(set.getTile(0).sprite.rect.x).toBe(1);
    expect(set.getTile(1).sprite.rect.x).toBe(131);
    expect(set.getTile(2).sprite.rect.y).toBe(131);
  });

  it("throws on out-of-range getTile and returns undefined for tryGetTile", () => {
    const set: TileSet = new TileSet(fakeTexture("t", 128, 128), {
      tileWidth: 128,
      tileHeight: 128,
    });

    expect(set.count).toBe(1);
    expect(() => set.getTile(1)).toThrow();
    expect(set.tryGetTile(1)).toBeUndefined();
    expect(set.tryGetTile(0)).toBeInstanceOf(Tile);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/tileset.test.ts`
Expected: FAIL — `Cannot find module '../src/assets/TileSet'`.

- [ ] **Step 3: Write `Tile`**

```ts
// packages/gameplay/src/assets/Tile.ts
import { Sprite } from "./Sprite";

export class Tile {
  public readonly index: number;
  public readonly sprite: Sprite;

  public constructor(index: number, sprite: Sprite) {
    this.index = index;
    this.sprite = sprite;
  }
}
```

- [ ] **Step 4: Write `TileSet`**

```ts
// packages/gameplay/src/assets/TileSet.ts
import { Bound, Vec2 } from "@atlasjs/math";
import type { Texture2D } from "@atlasjs/nebula";
import type { Resource } from "@atlasjs/assets";
import { Sprite } from "./Sprite";
import { Tile } from "./Tile";

export interface TileSetOptions {
  tileWidth: number;
  tileHeight: number;
  columns?: number;
  rows?: number;
  spacing?: number;
  margin?: number;
  pivot?: Vec2;
  id?: string;
}

export class TileSet implements Resource {
  public readonly id: string;
  public readonly texture: Texture2D;
  public readonly columns: number;
  public readonly rows: number;

  private readonly tiles: Tile[];

  public constructor(texture: Texture2D, options: TileSetOptions) {
    const spacing: number = options.spacing ?? 0;
    const margin: number = options.margin ?? 0;
    const tileWidth: number = options.tileWidth;
    const tileHeight: number = options.tileHeight;

    const columns: number =
      options.columns ??
      Math.floor((texture.width - 2 * margin + spacing) / (tileWidth + spacing));
    const rows: number =
      options.rows ??
      Math.floor((texture.height - 2 * margin + spacing) / (tileHeight + spacing));

    this.texture = texture;
    this.columns = columns;
    this.rows = rows;
    this.id =
      options.id ??
      `tileset:${texture.id}:${tileWidth}x${tileHeight}:${columns}x${rows}:${spacing}:${margin}`;

    this.tiles = [];

    for (let row: number = 0; row < rows; row++) {
      for (let col: number = 0; col < columns; col++) {
        const index: number = row * columns + col;
        const rect: Bound = new Bound(
          margin + col * (tileWidth + spacing),
          margin + row * (tileHeight + spacing),
          tileWidth,
          tileHeight,
        );
        const sprite: Sprite = new Sprite(texture, {
          rect,
          pivot: options.pivot,
        });
        this.tiles.push(new Tile(index, sprite));
      }
    }
  }

  public get count(): number {
    return this.tiles.length;
  }

  public getTile(index: number): Tile {
    const tile: Tile | undefined = this.tiles[index];
    if (tile === undefined) {
      throw new Error(`TileSet index ${index} out of range [0, ${this.count}).`);
    }
    return tile;
  }

  public tryGetTile(index: number): Tile | undefined {
    return this.tiles[index];
  }

  public indexOf(col: number, row: number): number {
    return row * this.columns + col;
  }

  public destroy(): void {}
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/tileset.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Review & commit checkpoint**

STOP. Présenter le diff. L'utilisateur relit et committe.
Suggested message: `feat(gameplay): add TileSet asset with grid slicing + Tile seam`

---

## Task 2: `TileSetAsset` + `TileSetLoader`

**Files:**
- Create: `packages/gameplay/src/assets/TileSetAsset.ts`
- Create: `packages/gameplay/src/assets/TileSetLoader.ts`
- Modify: `packages/gameplay/src/assets/index.ts` (barrel — ajouter les exports)
- Modify: `packages/gameplay/src/GameplayPlugin.ts` (enregistrer le loader)
- Test: `packages/gameplay/test/tileset-loader.test.ts`

**Interfaces:**
- Consumes: `Asset`/`AssetLoader`/`LoadContext`/`Resource` (`@atlasjs/assets`), `TextureAsset`/`Texture2D` (`@atlasjs/nebula`), `TileSet`/`TileSetOptions` (Task 1), `Vec2` (`@atlasjs/math`).
- Produces:
  - `interface TileSetAssetOptions { tileWidth: number; tileHeight: number; columns?: number; rows?: number; spacing?: number; margin?: number; pivot?: Vec2; id?: string }`
  - `class TileSetAsset implements Asset { readonly type: string; readonly id: string; readonly texture: TextureAsset; readonly tileWidth: number; readonly tileHeight: number; readonly columns?: number; readonly rows?: number; readonly spacing: number; readonly margin: number; readonly pivot?: Vec2; constructor(texture: TextureAsset, options: TileSetAssetOptions); static fromPath(path: string, options: TileSetAssetOptions): TileSetAsset }`
  - `class TileSetLoader implements AssetLoader<TileSetAsset, TileSet> { readonly type: string; load(asset: TileSetAsset, ctx: LoadContext): Promise<TileSet> }`

- [ ] **Step 1: Write the failing test**

```ts
// packages/gameplay/test/tileset-loader.test.ts
import { describe, expect, it } from "vitest";
import { Asset, LoadContext, Resource } from "@atlasjs/assets";
import { TextureAsset, Texture2D } from "@atlasjs/nebula";
import { TileSetAsset } from "../src/assets/TileSetAsset";
import { TileSetLoader } from "../src/assets/TileSetLoader";
import { TileSet } from "../src/assets/TileSet";
import { fakeTexture } from "./helpers/fakes";

describe("TileSetAsset", () => {
  it("has type 'tileset' and derives its id from texture + slicing params", () => {
    const asset: TileSetAsset = new TileSetAsset(new TextureAsset("grass.png"), {
      tileWidth: 128,
      tileHeight: 128,
      columns: 2,
      rows: 2,
    });

    expect(asset.type).toBe("tileset");
    expect(asset.id).toBe("tileset:texture:grass.png:128x128:2x2:0:0");
  });

  it("accepts an explicit id and defaults spacing/margin to 0", () => {
    const asset: TileSetAsset = new TileSetAsset(new TextureAsset("x.png"), {
      tileWidth: 16,
      tileHeight: 16,
      id: "atlas",
    });

    expect(asset.id).toBe("atlas");
    expect(asset.spacing).toBe(0);
    expect(asset.margin).toBe(0);
  });
});

describe("TileSetLoader", () => {
  it("resolves the texture via the context then builds a TileSet", async () => {
    const texture: Texture2D = fakeTexture("grass", 256, 256);
    const ctx: LoadContext = {
      load: async <R extends Resource>(_asset: Asset): Promise<R> =>
        texture as unknown as R,
    };
    const loader: TileSetLoader = new TileSetLoader();
    const asset: TileSetAsset = new TileSetAsset(new TextureAsset("grass.png"), {
      tileWidth: 128,
      tileHeight: 128,
    });

    const set: TileSet = await loader.load(asset, ctx);

    expect(set).toBeInstanceOf(TileSet);
    expect(set.texture).toBe(texture);
    expect(set.count).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/tileset-loader.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `TileSetAsset`**

```ts
// packages/gameplay/src/assets/TileSetAsset.ts
import { Vec2 } from "@atlasjs/math";
import type { Asset } from "@atlasjs/assets";
import { TextureAsset } from "@atlasjs/nebula";

export interface TileSetAssetOptions {
  tileWidth: number;
  tileHeight: number;
  columns?: number;
  rows?: number;
  spacing?: number;
  margin?: number;
  pivot?: Vec2;
  id?: string;
}

export class TileSetAsset implements Asset {
  public readonly type: string = "tileset";
  public readonly id: string;
  public readonly texture: TextureAsset;
  public readonly tileWidth: number;
  public readonly tileHeight: number;
  public readonly columns?: number;
  public readonly rows?: number;
  public readonly spacing: number;
  public readonly margin: number;
  public readonly pivot?: Vec2;

  public constructor(texture: TextureAsset, options: TileSetAssetOptions) {
    this.texture = texture;
    this.tileWidth = options.tileWidth;
    this.tileHeight = options.tileHeight;
    this.columns = options.columns;
    this.rows = options.rows;
    this.spacing = options.spacing ?? 0;
    this.margin = options.margin ?? 0;
    this.pivot = options.pivot;

    const cols: string = options.columns === undefined ? "auto" : `${options.columns}`;
    const rows: string = options.rows === undefined ? "auto" : `${options.rows}`;
    this.id =
      options.id ??
      `${this.type}:${texture.id}:${this.tileWidth}x${this.tileHeight}:${cols}x${rows}:${this.spacing}:${this.margin}`;
  }

  public static fromPath(path: string, options: TileSetAssetOptions): TileSetAsset {
    return new TileSetAsset(new TextureAsset(path), options);
  }
}
```

- [ ] **Step 4: Write `TileSetLoader`**

```ts
// packages/gameplay/src/assets/TileSetLoader.ts
import type { AssetLoader, LoadContext } from "@atlasjs/assets";
import type { Texture2D } from "@atlasjs/nebula";
import { TileSet } from "./TileSet";
import { TileSetAsset } from "./TileSetAsset";

export class TileSetLoader implements AssetLoader<TileSetAsset, TileSet> {
  public readonly type: string = "tileset";

  public async load(asset: TileSetAsset, ctx: LoadContext): Promise<TileSet> {
    const texture: Texture2D = await ctx.load<Texture2D>(asset.texture);

    return new TileSet(texture, {
      tileWidth: asset.tileWidth,
      tileHeight: asset.tileHeight,
      columns: asset.columns,
      rows: asset.rows,
      spacing: asset.spacing,
      margin: asset.margin,
      pivot: asset.pivot,
      id: asset.id,
    });
  }
}
```

- [ ] **Step 5: Export from the assets barrel**

Dans `packages/gameplay/src/assets/index.ts`, ajouter aux exports existants (`Sprite`, `SpriteAsset`, `SpriteLoader`) :

```ts
export * from "./Tile";
export * from "./TileSet";
export * from "./TileSetAsset";
export * from "./TileSetLoader";
```

- [ ] **Step 6: Register the loader in `GameplayPlugin`**

Dans `packages/gameplay/src/GameplayPlugin.ts` :
- Ajouter `TileSetLoader` à l'import depuis `"./assets"` (ligne `import { SpriteLoader } from "./assets";` → `import { SpriteLoader, TileSetLoader } from "./assets";`).
- Dans `install`, juste après `assets.register(new SpriteLoader());`, ajouter :

```ts
    assets.register(new TileSetLoader());
```

- [ ] **Step 7: Run tests + typecheck**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/tileset-loader.test.ts`
Expected: PASS (3 tests).
Run: `pnpm --filter @atlasjs/gameplay run typecheck`
Expected: no errors.

- [ ] **Step 8: Review & commit checkpoint**

STOP. Diff → relecture utilisateur → commit.
Suggested message: `feat(gameplay): add TileSetAsset + TileSetLoader, register in GameplayPlugin`

---

## Task 3: `Grid` + `TileMapRenderer` components

**Files:**
- Create: `packages/gameplay/src/components/Grid.ts`
- Create: `packages/gameplay/src/components/TileMapRenderer.ts`
- Modify: `packages/gameplay/src/components/index.ts` (barrel)
- Test: `packages/gameplay/test/tilemap-components.test.ts`

**Interfaces:**
- Consumes: `Vec2` (`@atlasjs/math`), `Color` (`@atlasjs/nebula`).
- Produces:
  - `class Grid { cellSize: Vec2; cellGap: Vec2; constructor(cellSize: Vec2, cellGap?: Vec2) }`
  - `class TileMapRenderer { sortingOrder: number; color: Color; visible: boolean; constructor(sortingOrder?: number, color?: Color, visible?: boolean) }`

- [ ] **Step 1: Write the failing test**

```ts
// packages/gameplay/test/tilemap-components.test.ts
import { describe, expect, it } from "vitest";
import { Vec2 } from "@atlasjs/math";
import { Color } from "@atlasjs/nebula";
import { Grid } from "../src/components/Grid";
import { TileMapRenderer } from "../src/components/TileMapRenderer";

describe("Grid component", () => {
  it("stores cellSize and defaults cellGap to (0,0)", () => {
    const grid: Grid = new Grid(new Vec2(128, 128));
    expect(grid.cellSize.x).toBe(128);
    expect(grid.cellSize.y).toBe(128);
    expect(grid.cellGap.x).toBe(0);
    expect(grid.cellGap.y).toBe(0);
  });

  it("accepts an explicit cellGap", () => {
    const grid: Grid = new Grid(new Vec2(16, 16), new Vec2(2, 4));
    expect(grid.cellGap.x).toBe(2);
    expect(grid.cellGap.y).toBe(4);
  });
});

describe("TileMapRenderer component", () => {
  it("defaults to sortingOrder 0, white, visible", () => {
    const renderer: TileMapRenderer = new TileMapRenderer();
    expect(renderer.sortingOrder).toBe(0);
    expect(renderer.visible).toBe(true);
    expect(renderer.color.r).toBe(1);
    expect(renderer.color.a).toBe(1);
  });

  it("accepts explicit values", () => {
    const renderer: TileMapRenderer = new TileMapRenderer(10, Color.Red(), false);
    expect(renderer.sortingOrder).toBe(10);
    expect(renderer.visible).toBe(false);
    expect(renderer.color.r).toBe(1);
    expect(renderer.color.g).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/tilemap-components.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `Grid`**

```ts
// packages/gameplay/src/components/Grid.ts
import { Vec2 } from "@atlasjs/math";

export class Grid {
  public cellSize: Vec2;
  public cellGap: Vec2;

  public constructor(cellSize: Vec2, cellGap: Vec2 = new Vec2(0, 0)) {
    this.cellSize = cellSize;
    this.cellGap = cellGap;
  }
}
```

- [ ] **Step 4: Write `TileMapRenderer`**

```ts
// packages/gameplay/src/components/TileMapRenderer.ts
import { Color } from "@atlasjs/nebula";

export class TileMapRenderer {
  public sortingOrder: number;
  public color: Color;
  public visible: boolean;

  public constructor(
    sortingOrder: number = 0,
    color: Color = Color.White(),
    visible: boolean = true,
  ) {
    this.sortingOrder = sortingOrder;
    this.color = color;
    this.visible = visible;
  }
}
```

- [ ] **Step 5: Export from the components barrel**

Dans `packages/gameplay/src/components/index.ts`, ajouter :

```ts
export * from "./Grid";
export * from "./TileMapRenderer";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/tilemap-components.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Review & commit checkpoint**

STOP. Diff → relecture → commit.
Suggested message: `feat(gameplay): add Grid + TileMapRenderer components`

---

## Task 4: `TileMap` component (stockage + API de remplissage)

**Files:**
- Create: `packages/gameplay/src/components/TileMap.ts`
- Modify: `packages/gameplay/src/components/index.ts` (barrel)
- Test: `packages/gameplay/test/tilemap.test.ts`

**Interfaces:**
- Consumes: `TileSet` (Task 1).
- Produces:
  - `class TileMap { readonly tileset: TileSet; get revision(): number; setTile(cx: number, cy: number, tileIndex: number): void; getTile(cx: number, cy: number): number; hasTile(cx: number, cy: number): boolean; removeTile(cx: number, cy: number): void; fill(cx0: number, cy0: number, cx1: number, cy1: number, tileIndex: number): void; clear(): void; forEachTile(fn: (cx: number, cy: number, tileIndex: number) => void): void; constructor(tileset: TileSet) }`

- [ ] **Step 1: Write the failing test**

```ts
// packages/gameplay/test/tilemap.test.ts
import { describe, expect, it } from "vitest";
import { TileSet } from "../src/assets/TileSet";
import { TileMap } from "../src/components/TileMap";
import { fakeTexture } from "./helpers/fakes";

function makeTileSet(): TileSet {
  return new TileSet(fakeTexture("t", 256, 256), {
    tileWidth: 128,
    tileHeight: 128,
  });
}

describe("TileMap storage", () => {
  it("returns -1 for an empty cell and stores a tile index", () => {
    const map: TileMap = new TileMap(makeTileSet());
    expect(map.getTile(3, 5)).toBe(-1);
    expect(map.hasTile(3, 5)).toBe(false);

    map.setTile(3, 5, 2);
    expect(map.getTile(3, 5)).toBe(2);
    expect(map.hasTile(3, 5)).toBe(true);
  });

  it("clears a cell via a negative index or removeTile", () => {
    const map: TileMap = new TileMap(makeTileSet());
    map.setTile(1, 1, 0);
    map.setTile(1, 1, -1);
    expect(map.getTile(1, 1)).toBe(-1);

    map.setTile(2, 2, 0);
    map.removeTile(2, 2);
    expect(map.hasTile(2, 2)).toBe(false);
  });

  it("supports negative coordinates round-trip via forEachTile", () => {
    const map: TileMap = new TileMap(makeTileSet());
    map.setTile(-3, -7, 1);

    const seen: Array<[number, number, number]> = [];
    map.forEachTile((cx: number, cy: number, index: number) => {
      seen.push([cx, cy, index]);
    });

    expect(seen).toEqual([[-3, -7, 1]]);
  });

  it("fills an inclusive rectangle and clears everything", () => {
    const map: TileMap = new TileMap(makeTileSet());
    map.fill(0, 0, 2, 1, 3);

    let count: number = 0;
    map.forEachTile(() => {
      count++;
    });
    expect(count).toBe(6);
    expect(map.getTile(2, 1)).toBe(3);

    map.clear();
    expect(map.getTile(0, 0)).toBe(-1);
  });

  it("bumps revision on mutation only", () => {
    const map: TileMap = new TileMap(makeTileSet());
    const r0: number = map.revision;

    map.setTile(0, 0, 1);
    const r1: number = map.revision;
    expect(r1).toBeGreaterThan(r0);

    map.removeTile(9, 9);
    expect(map.revision).toBe(r1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/tilemap.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `TileMap`**

```ts
// packages/gameplay/src/components/TileMap.ts
import { TileSet } from "../assets/TileSet";

const KEY_OFFSET: number = 32768;
const KEY_STRIDE: number = 65536;

export class TileMap {
  public readonly tileset: TileSet;

  private readonly cells: Map<number, number>;
  private currentRevision: number;

  public constructor(tileset: TileSet) {
    this.tileset = tileset;
    this.cells = new Map<number, number>();
    this.currentRevision = 0;
  }

  public get revision(): number {
    return this.currentRevision;
  }

  public setTile(cx: number, cy: number, tileIndex: number): void {
    if (tileIndex < 0) {
      this.removeTile(cx, cy);
      return;
    }
    this.cells.set(this.key(cx, cy), tileIndex);
    this.currentRevision++;
  }

  public getTile(cx: number, cy: number): number {
    const value: number | undefined = this.cells.get(this.key(cx, cy));
    return value === undefined ? -1 : value;
  }

  public hasTile(cx: number, cy: number): boolean {
    return this.cells.has(this.key(cx, cy));
  }

  public removeTile(cx: number, cy: number): void {
    if (this.cells.delete(this.key(cx, cy))) {
      this.currentRevision++;
    }
  }

  public fill(cx0: number, cy0: number, cx1: number, cy1: number, tileIndex: number): void {
    const xMin: number = Math.min(cx0, cx1);
    const xMax: number = Math.max(cx0, cx1);
    const yMin: number = Math.min(cy0, cy1);
    const yMax: number = Math.max(cy0, cy1);

    for (let cy: number = yMin; cy <= yMax; cy++) {
      for (let cx: number = xMin; cx <= xMax; cx++) {
        this.setTile(cx, cy, tileIndex);
      }
    }
  }

  public clear(): void {
    if (this.cells.size > 0) {
      this.cells.clear();
      this.currentRevision++;
    }
  }

  public forEachTile(fn: (cx: number, cy: number, tileIndex: number) => void): void {
    for (const [packed, index] of this.cells) {
      const cx: number = Math.floor(packed / KEY_STRIDE) - KEY_OFFSET;
      const cy: number = (packed % KEY_STRIDE) - KEY_OFFSET;
      fn(cx, cy, index);
    }
  }

  private key(cx: number, cy: number): number {
    return (cx + KEY_OFFSET) * KEY_STRIDE + (cy + KEY_OFFSET);
  }
}
```

- [ ] **Step 4: Export from the components barrel**

Dans `packages/gameplay/src/components/index.ts`, ajouter :

```ts
export * from "./TileMap";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/tilemap.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Review & commit checkpoint**

STOP. Diff → relecture → commit.
Suggested message: `feat(gameplay): add TileMap component (sparse cell storage + fill API)`

---

## Task 5: helpers de géométrie de grille

**Files:**
- Create: `packages/gameplay/src/systems/tilemap-geometry.ts`
- Test: `packages/gameplay/test/tilemap-geometry.test.ts`

**Interfaces:**
- Consumes: `Bound`/`Mat3`/`Vec2` (`@atlasjs/math`).
- Produces:
  - `interface CellRange { cxMin: number; cyMin: number; cxMax: number; cyMax: number }`
  - `function cellOrigin(cellSize: Vec2, cellGap: Vec2, cx: number, cy: number): { x: number; y: number }`
  - `function worldBoundToLocalBound(invWorld: Mat3, worldBound: Bound): Bound`
  - `function visibleCellRange(cellSize: Vec2, cellGap: Vec2, local: Bound): CellRange`

- [ ] **Step 1: Write the failing test**

```ts
// packages/gameplay/test/tilemap-geometry.test.ts
import { describe, expect, it } from "vitest";
import { Bound, Mat3, Transform2D, Vec2 } from "@atlasjs/math";
import {
  cellOrigin,
  visibleCellRange,
  worldBoundToLocalBound,
} from "../src/systems/tilemap-geometry";

describe("cellOrigin", () => {
  it("computes the min-corner origin including the gap", () => {
    const origin = cellOrigin(new Vec2(128, 128), new Vec2(0, 0), 2, 3);
    expect(origin.x).toBe(256);
    expect(origin.y).toBe(384);

    const gapped = cellOrigin(new Vec2(16, 16), new Vec2(2, 4), 3, 2);
    expect(gapped.x).toBe(54);
    expect(gapped.y).toBe(40);
  });
});

describe("visibleCellRange", () => {
  it("returns the inclusive cell range overlapping a local bound", () => {
    const range = visibleCellRange(
      new Vec2(128, 128),
      new Vec2(0, 0),
      new Bound(200, 0, 300, 100),
    );
    expect(range.cxMin).toBe(1);
    expect(range.cxMax).toBe(3);
    expect(range.cyMin).toBe(0);
    expect(range.cyMax).toBe(0);
  });
});

describe("worldBoundToLocalBound", () => {
  it("is identity for an identity matrix", () => {
    const local: Bound = worldBoundToLocalBound(
      Mat3.identity(),
      new Bound(10, 20, 30, 40),
    );
    expect(local.x).toBeCloseTo(10, 4);
    expect(local.y).toBeCloseTo(20, 4);
    expect(local.width).toBeCloseTo(30, 4);
    expect(local.height).toBeCloseTo(40, 4);
  });

  it("undoes a world translation", () => {
    const world: Mat3 = new Mat3().fromTransform2D(new Transform2D(new Vec2(100, 50)));
    const inv: Mat3 = world.clone().invert();

    const local: Bound = worldBoundToLocalBound(inv, new Bound(100, 50, 20, 20));
    expect(local.x).toBeCloseTo(0, 4);
    expect(local.y).toBeCloseTo(0, 4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/tilemap-geometry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the geometry helpers**

```ts
// packages/gameplay/src/systems/tilemap-geometry.ts
import { Bound, Mat3, Vec2 } from "@atlasjs/math";

export interface CellRange {
  cxMin: number;
  cyMin: number;
  cxMax: number;
  cyMax: number;
}

export function cellOrigin(
  cellSize: Vec2,
  cellGap: Vec2,
  cx: number,
  cy: number,
): { x: number; y: number } {
  return {
    x: cx * (cellSize.x + cellGap.x),
    y: cy * (cellSize.y + cellGap.y),
  };
}

export function worldBoundToLocalBound(invWorld: Mat3, worldBound: Bound): Bound {
  const x0: number = worldBound.x;
  const y0: number = worldBound.y;
  const x1: number = worldBound.x + worldBound.width;
  const y1: number = worldBound.y + worldBound.height;

  const c0: Vec2 = invWorld.transformPoint2(x0, y0);
  const c1: Vec2 = invWorld.transformPoint2(x1, y0);
  const c2: Vec2 = invWorld.transformPoint2(x0, y1);
  const c3: Vec2 = invWorld.transformPoint2(x1, y1);

  const minX: number = Math.min(c0.x, c1.x, c2.x, c3.x);
  const minY: number = Math.min(c0.y, c1.y, c2.y, c3.y);
  const maxX: number = Math.max(c0.x, c1.x, c2.x, c3.x);
  const maxY: number = Math.max(c0.y, c1.y, c2.y, c3.y);

  return new Bound(minX, minY, maxX - minX, maxY - minY);
}

export function visibleCellRange(
  cellSize: Vec2,
  cellGap: Vec2,
  local: Bound,
): CellRange {
  const strideX: number = cellSize.x + cellGap.x;
  const strideY: number = cellSize.y + cellGap.y;

  return {
    cxMin: Math.floor(local.x / strideX),
    cyMin: Math.floor(local.y / strideY),
    cxMax: Math.floor((local.x + local.width) / strideX),
    cyMax: Math.floor((local.y + local.height) / strideY),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/tilemap-geometry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Review & commit checkpoint**

STOP. Diff → relecture → commit.
Suggested message: `feat(gameplay): add tilemap grid geometry helpers`

---

## Task 6: nebula `TileMapNode` + `TileMapDrawCommand` + kind "tilemap"

**Files:**
- Create: `packages/nebula/src/graphics/TileMapNode.ts`
- Modify: `packages/nebula/src/graphics/index.ts` (barrel)
- Modify: `packages/nebula/src/renderers/DrawCommand.ts` (ajouter `TileMapDrawCommand` + union)
- Modify: `packages/nebula/src/renderers/NodeRenderer.ts` (`KIND_ORDER` + `tilemap`)
- Test: `packages/nebula/test/TileMapNode.test.ts`

**Interfaces:**
- Consumes: `Node` (`packages/nebula/src/graphics/Node.ts`), `Vec4`/`Mat4` (`@atlasjs/math`), `BlendMode`/`Sampler`/`Texture2D`/`RenderState` (`../core`).
- Produces:
  - `interface TileInstance { x: number; y: number; width: number; height: number; uvRect: Vec4 }`
  - `class TileMapNode extends Node { texture: Texture2D | null; sampler?: Sampler; blend: BlendMode; tint: Vec4; instances: TileInstance[] }`
  - `type TileMapDrawCommand = { readonly kind: "tilemap"; readonly sortKey: number; readonly batchKey: number; readonly renderState: RenderState; readonly texture: Texture2D; readonly sampler: Sampler; readonly tint: Vec4; readonly models: ReadonlyArray<Mat4>; readonly uvRects: ReadonlyArray<Vec4>; readonly count: number }`
  - `KIND_ORDER.tilemap === 2`

- [ ] **Step 1: Write the failing test**

```ts
// packages/nebula/test/TileMapNode.test.ts
import { describe, expect, it } from "vitest";
import { TileMapNode } from "../src/graphics/TileMapNode";
import { KIND_ORDER } from "../src/renderers/NodeRenderer";

describe("TileMapNode", () => {
  it("defaults to alpha blend, white tint, no texture, empty instances", () => {
    const node: TileMapNode = new TileMapNode();
    expect(node.texture).toBeNull();
    expect(node.blend).toBe("alpha");
    expect(node.tint.x).toBe(1);
    expect(node.tint.w).toBe(1);
    expect(node.instances.length).toBe(0);
    expect(node.visible).toBe(true);
  });
});

describe("KIND_ORDER", () => {
  it("orders tilemap after sprite and shape", () => {
    expect(KIND_ORDER.tilemap).toBe(2);
    expect(KIND_ORDER.tilemap).toBeGreaterThan(KIND_ORDER.sprite);
    expect(KIND_ORDER.tilemap).toBeGreaterThan(KIND_ORDER.shape);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/nebula exec vitest run test/TileMapNode.test.ts`
Expected: FAIL — module not found / `KIND_ORDER.tilemap` undefined.

- [ ] **Step 3: Write `TileMapNode`**

```ts
// packages/nebula/src/graphics/TileMapNode.ts
import { Vec4 } from "@atlasjs/math";
import { BlendMode, Sampler, Texture2D } from "../core";
import { Node } from "./Node";

export interface TileInstance {
  x: number;
  y: number;
  width: number;
  height: number;
  uvRect: Vec4;
}

export class TileMapNode extends Node {
  public texture: Texture2D | null;
  public sampler?: Sampler;
  public blend: BlendMode;
  public tint: Vec4;
  public instances: TileInstance[];

  public constructor() {
    super();
    this.texture = null;
    this.blend = "alpha";
    this.tint = new Vec4(1, 1, 1, 1);
    this.instances = [];
  }
}
```

- [ ] **Step 4: Export from the graphics barrel**

Dans `packages/nebula/src/graphics/index.ts`, ajouter :

```ts
export * from "./TileMapNode";
```

- [ ] **Step 5: Add `TileMapDrawCommand` to the DrawCommand union**

Dans `packages/nebula/src/renderers/DrawCommand.ts`, ajouter le type et l'inclure dans l'union :

```ts
export type TileMapDrawCommand = {
  readonly kind: "tilemap";
  readonly sortKey: number;
  readonly batchKey: number;
  readonly renderState: RenderState;
  readonly texture: Texture2D;
  readonly sampler: Sampler;
  readonly tint: Vec4;
  readonly models: ReadonlyArray<Mat4>;
  readonly uvRects: ReadonlyArray<Vec4>;
  readonly count: number;
};

export type DrawCommand = SpriteDrawCommand | ShapeDrawCommand | TileMapDrawCommand;
```

- [ ] **Step 6: Add "tilemap" to `KIND_ORDER`**

Dans `packages/nebula/src/renderers/NodeRenderer.ts`, étendre `KIND_ORDER` :

```ts
export const KIND_ORDER: Record<DrawCommand["kind"], number> = {
  sprite: 0,
  shape: 1,
  tilemap: 2,
};
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter @atlasjs/nebula exec vitest run test/TileMapNode.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Review & commit checkpoint**

STOP. Diff → relecture → commit.
Suggested message: `feat(nebula): add TileMapNode + TileMapDrawCommand kind`

---

## Task 7: nebula `TileMapNodeRenderer` + `TileMapBatcher` + enregistrement

**Files:**
- Create: `packages/nebula/src/renderers/TileMapNodeRenderer.ts`
- Modify: `packages/nebula/src/renderers/Batchers.ts` (ajouter `TileMapBatcher`)
- Modify: `packages/nebula/src/renderers/index.ts` (barrel)
- Modify: `packages/nebula/src/renderers/SceneRenderer.ts` (enregistrer le NodeRenderer)
- Test: `packages/nebula/test/TileMapNodeRenderer.test.ts`

**Interfaces:**
- Consumes: `TileMapNode`/`TileInstance` (Task 6), `TileMapDrawCommand` (Task 6), `NodeRendererBase`, `NodeRenderer`/`Batcher`/`KIND_ORDER`, `SpriteBatch`/`Renderer`/`Sampler` (`../core`), `Mat4`/`Vec4`/`Bound` (`@atlasjs/math`).
- Produces:
  - `class TileMapNodeRenderer extends NodeRendererBase<TileMapNode, TileMapRenderData> implements NodeRenderer { readonly kind: "tilemap"; matches(node): boolean; collect(node, viewport, scratch): TileMapDrawCommand | null; createBatcher(renderer): Batcher }`
  - `class TileMapBatcher implements Batcher`

- [ ] **Step 1: Write the failing test**

```ts
// packages/nebula/test/TileMapNodeRenderer.test.ts
import { describe, expect, it } from "vitest";
import { Bound, Vec4 } from "@atlasjs/math";
import { TileMapNode } from "../src/graphics/TileMapNode";
import { TileMapNodeRenderer } from "../src/renderers/TileMapNodeRenderer";
import { TileMapBatcher } from "../src/renderers/Batchers";
import { TileMapDrawCommand } from "../src/renderers/DrawCommand";
import { Renderer, Sampler, SpriteBatch, Texture2D } from "../src/core";

function fakeTexture(id: string = "grass", width: number = 256, height: number = 256): Texture2D {
  return { id, __kind: "texture2D", width, height, destroy: (): void => {} } as Texture2D;
}

function fakeRenderer(): Renderer {
  return {
    createSampler: (): Sampler => ({ id: "default-sampler" }) as Sampler,
    createSpriteBatch: (): SpriteBatch => ({}) as SpriteBatch,
  } as unknown as Renderer;
}

describe("TileMapNodeRenderer.collect", () => {
  it("returns null when the node has no texture or no instances", () => {
    const renderer: TileMapNodeRenderer = new TileMapNodeRenderer(fakeRenderer());
    const node: TileMapNode = new TileMapNode();
    node.updateWorldMatrix();

    expect(renderer.collect(node, new Bound(), new Bound())).toBeNull();

    node.texture = fakeTexture();
    expect(renderer.collect(node, new Bound(), new Bound())).toBeNull();
  });

  it("builds one command whose instance model places the tile at its cell footprint", () => {
    const renderer: TileMapNodeRenderer = new TileMapNodeRenderer(fakeRenderer());
    const node: TileMapNode = new TileMapNode();
    node.texture = fakeTexture("grass", 256, 256);
    node.sampler = { id: "smp" } as Sampler;
    node.instances = [
      { x: 128, y: 0, width: 128, height: 128, uvRect: new Vec4(0.5, 0, 0.5, 0.5) },
    ];
    node.updateWorldMatrix();

    const command: TileMapDrawCommand | null = renderer.collect(node, new Bound(), new Bound());
    expect(command).not.toBeNull();
    const cmd: TileMapDrawCommand = command as TileMapDrawCommand;

    expect(cmd.kind).toBe("tilemap");
    expect(cmd.count).toBe(1);
    expect(cmd.models[0].buffer[12]).toBeCloseTo(192, 4);
    expect(cmd.models[0].buffer[13]).toBeCloseTo(64, 4);
    expect(cmd.models[0].buffer[0]).toBeCloseTo(128, 4);
    expect(cmd.models[0].buffer[5]).toBeCloseTo(128, 4);
    expect(cmd.uvRects[0].x).toBeCloseTo(0.5, 4);
  });

  it("orders a higher zIndex node after a lower one", () => {
    const renderer: TileMapNodeRenderer = new TileMapNodeRenderer(fakeRenderer());

    const low: TileMapNode = new TileMapNode();
    low.texture = fakeTexture();
    low.sampler = { id: "smp" } as Sampler;
    low.zIndex = 0;
    low.instances = [{ x: 0, y: 0, width: 16, height: 16, uvRect: new Vec4(0, 0, 1, 1) }];
    low.updateWorldMatrix();

    const high: TileMapNode = new TileMapNode();
    high.texture = fakeTexture();
    high.sampler = { id: "smp" } as Sampler;
    high.zIndex = 5;
    high.instances = [{ x: 0, y: 0, width: 16, height: 16, uvRect: new Vec4(0, 0, 1, 1) }];
    high.updateWorldMatrix();

    const lowCmd: TileMapDrawCommand = renderer.collect(low, new Bound(), new Bound()) as TileMapDrawCommand;
    const highCmd: TileMapDrawCommand = renderer.collect(high, new Bound(), new Bound()) as TileMapDrawCommand;

    expect(highCmd.sortKey).toBeGreaterThan(lowCmd.sortKey);
  });
});

describe("TileMapBatcher", () => {
  it("begins once with the command texture and adds one instance per tile", () => {
    const calls: { begins: number; adds: number } = { begins: 0, adds: 0 };
    const batch: SpriteBatch = {
      begin: (): void => {
        calls.begins++;
      },
      add: (): void => {
        calls.adds++;
      },
    } as unknown as SpriteBatch;

    const batcher: TileMapBatcher = new TileMapBatcher(batch);
    const command: TileMapDrawCommand = {
      kind: "tilemap",
      sortKey: 0,
      batchKey: 0,
      renderState: { blend: "alpha", depthTest: false, cull: "none" },
      texture: fakeTexture(),
      sampler: { id: "smp" } as Sampler,
      tint: new Vec4(1, 1, 1, 1),
      models: [],
      uvRects: [],
      count: 3,
    } as unknown as TileMapDrawCommand;

    batcher.begin(command);
    batcher.add(command);

    expect(calls.begins).toBe(1);
    expect(calls.adds).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/nebula exec vitest run test/TileMapNodeRenderer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `TileMapNodeRenderer`**

```ts
// packages/nebula/src/renderers/TileMapNodeRenderer.ts
import { Bound, Mat4, Vec4 } from "@atlasjs/math";
import { Node, TileInstance, TileMapNode } from "../graphics";
import { TileMapDrawCommand } from "./DrawCommand";
import { NodeRendererBase } from "./NodeRendererBase";
import { NodeRenderer, Batcher, KIND_ORDER } from "./NodeRenderer";
import { TileMapBatcher } from "./Batchers";
import { Renderer, Sampler } from "../core";

type TileMapRenderData = {
  models: Mat4[];
  uvRects: Vec4[];
};

export class TileMapNodeRenderer
  extends NodeRendererBase<TileMapNode, TileMapRenderData>
  implements NodeRenderer
{
  public readonly kind = "tilemap" as const;

  private readonly defaultSampler: Sampler;
  private readonly batchIds: Map<string, number>;

  private nextBatchId: number;

  public constructor(renderer: Renderer) {
    super();

    this.batchIds = new Map();
    this.nextBatchId = 0;

    this.defaultSampler = renderer.createSampler({
      minFilter: "linear",
      magFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });
  }

  public matches(node: Node): boolean {
    return node instanceof TileMapNode;
  }

  public collect(
    node: Node,
    _viewport: Bound,
    _scratch: Bound,
  ): TileMapDrawCommand | null {
    const tilemap: TileMapNode = node as TileMapNode;

    if (tilemap.texture === null || tilemap.instances.length === 0) {
      return null;
    }

    const sampler: Sampler = tilemap.sampler ?? this.defaultSampler;
    const materialKey: string = `${tilemap.texture.id}|${sampler.id}|${tilemap.blend}`;
    const batchId: number = this.getBatchId(materialKey);

    const data: TileMapRenderData = this.getOrCreateRenderData(tilemap);
    this.updateInstances(tilemap, data);

    return {
      kind: "tilemap",
      sortKey: this.computeSortKey(tilemap.zIndex, KIND_ORDER.tilemap, batchId),
      batchKey: batchId,
      renderState: NodeRendererBase.RENDER_STATES[tilemap.blend],
      texture: tilemap.texture,
      sampler,
      tint: tilemap.tint,
      models: data.models,
      uvRects: data.uvRects,
      count: tilemap.instances.length,
    };
  }

  public createBatcher(renderer: Renderer): Batcher {
    return new TileMapBatcher(renderer.createSpriteBatch());
  }

  protected createRenderData(): TileMapRenderData {
    return { models: [], uvRects: [] };
  }

  private updateInstances(node: TileMapNode, data: TileMapRenderData): void {
    const worldMatrix: Mat4 = node.worldMatrix;
    const instances: TileInstance[] = node.instances;

    for (let i: number = 0; i < instances.length; i++) {
      const instance: TileInstance = instances[i];

      let model: Mat4 | undefined = data.models[i];
      if (model === undefined) {
        model = Mat4.identity();
        data.models[i] = model;
      }

      const centerX: number = instance.x + instance.width * 0.5;
      const centerY: number = instance.y + instance.height * 0.5;

      model
        .copy(worldMatrix)
        .translate(centerX, centerY, 0)
        .scale(instance.width, instance.height);

      data.uvRects[i] = instance.uvRect;
    }

    data.models.length = instances.length;
    data.uvRects.length = instances.length;
  }

  private getBatchId(key: string): number {
    const BATCH_MAX: number = 65535;
    let id: number | undefined = this.batchIds.get(key);

    if (id === undefined) {
      id = Math.min(this.nextBatchId, BATCH_MAX);
      this.nextBatchId++;
      this.batchIds.set(key, id);
    }

    return id;
  }
}
```

- [ ] **Step 4: Write `TileMapBatcher` in `Batchers.ts`**

Dans `packages/nebula/src/renderers/Batchers.ts`, ajouter l'import du type et la classe :

```ts
// ajouter TileMapDrawCommand à l'import existant depuis "./DrawCommand"
import { DrawCommand, SpriteDrawCommand, ShapeDrawCommand, TileMapDrawCommand } from "./DrawCommand";

export class TileMapBatcher implements Batcher {
  private readonly batch: SpriteBatch;

  public constructor(batch: SpriteBatch) {
    this.batch = batch;
  }

  public begin(command: DrawCommand): void {
    const c: TileMapDrawCommand = command as TileMapDrawCommand;
    this.batch.begin(c.texture, c.sampler, c.renderState);
  }

  public add(command: DrawCommand): void {
    const c: TileMapDrawCommand = command as TileMapDrawCommand;
    for (let i: number = 0; i < c.count; i++) {
      this.batch.add(c.models[i], c.uvRects[i], c.tint);
    }
  }

  public draw(renderer: Renderer): void {
    renderer.drawInstancedBatch(this.batch);
  }
}
```

- [ ] **Step 5: Export from the renderers barrel**

Dans `packages/nebula/src/renderers/index.ts`, ajouter :

```ts
export * from "./TileMapNodeRenderer";
```

(`TileMapBatcher` est déjà exporté via `export * from "./Batchers"`.)

- [ ] **Step 6: Register the NodeRenderer in `SceneRenderer`**

Dans `packages/nebula/src/renderers/SceneRenderer.ts` :
- Ajouter l'import : `import { TileMapNodeRenderer } from "./TileMapNodeRenderer";`
- Étendre le tableau `nodeRenderers` dans le constructeur :

```ts
    this.nodeRenderers = [
      new SpriteRenderer(renderer),
      new ShapeRenderer(),
      new TileMapNodeRenderer(renderer),
    ];
```

(La boucle existante enregistre automatiquement son `Batcher` dans le `RenderQueue`.)

- [ ] **Step 7: Run tests + compile nebula**

Run: `pnpm --filter @atlasjs/nebula exec vitest run test/TileMapNodeRenderer.test.ts`
Expected: PASS (4 tests).
Run: `pnpm --filter @atlasjs/nebula build`
Expected: build OK (dist régénéré, nécessaire pour les Tasks 8–10).

- [ ] **Step 8: Review & commit checkpoint**

STOP. Diff → relecture → commit.
Suggested message: `feat(nebula): add TileMapNodeRenderer + TileMapBatcher, register in SceneRenderer`

---

## Task 8: `TileMapRenderSystem` (rendu de toutes les cellules) + câblage plugin

> **Prérequis build** : `@atlasjs/nebula` doit être rebuild (Task 7 Step 7) pour que `TileMapNode`/`TileInstance` soient exportés dans son `dist`.

**Files:**
- Create: `packages/gameplay/src/systems/TileMapRenderSystem.ts`
- Modify: `packages/gameplay/src/systems/index.ts` (barrel)
- Modify: `packages/gameplay/src/GameplayPlugin.ts` (defineComponent + registerSystem + onRemove)
- Test: `packages/gameplay/test/tilemap-render-system.test.ts`

**Interfaces:**
- Consumes: `NebulaRenderer`/`TileMapNode`/`TileInstance` (`@atlasjs/nebula`), `Entity`/`NexusWorld`/`NexusSystem`/`NexusSystemContext` (`@atlasjs/nexus`), `Grid`/`TileMap`/`TileMapRenderer`/`WorldTransform2D` (composants), `Tile` (Task 1), `cellOrigin` (Task 5), `Bound`/`Vec4` (`@atlasjs/math`).
- Produces:
  - `class TileMapRenderSystem implements NexusSystem { constructor(nebula: NebulaRenderer); update(context: NexusSystemContext): void; unmount(entity: Entity): void }`

- [ ] **Step 1: Write the failing test**

```ts
// packages/gameplay/test/tilemap-render-system.test.ts
import { describe, expect, it } from "vitest";
import { Bound, Transform2D, Vec2 } from "@atlasjs/math";
import { NebulaRenderer, SceneGraph, TileMapNode } from "@atlasjs/nebula";
import { Entity, NexusWorld } from "@atlasjs/nexus";
import { TileSet } from "../src/assets/TileSet";
import { Grid, TileMap, TileMapRenderer, WorldTransform2D } from "../src/components";
import { TileMapRenderSystem } from "../src/systems";
import { fakeTexture } from "./helpers/fakes";

function setup(viewport: Bound = new Bound(-100000, -100000, 200000, 200000)): {
  world: NexusWorld;
  scene: SceneGraph;
  system: TileMapRenderSystem;
} {
  const world: NexusWorld = new NexusWorld();
  world
    .defineComponent(WorldTransform2D)
    .defineComponent(Grid)
    .defineComponent(TileMap)
    .defineComponent(TileMapRenderer);

  const scene: SceneGraph = new SceneGraph();
  const nebula: NebulaRenderer = {
    scene,
    getCameraViewport: (): Bound => viewport,
  } as unknown as NebulaRenderer;

  return { world, scene, system: new TileMapRenderSystem(nebula) };
}

function makeTileSet(): TileSet {
  return new TileSet(fakeTexture("grass", 256, 256), {
    tileWidth: 128,
    tileHeight: 128,
  });
}

function nodes(scene: SceneGraph): ReadonlyArray<TileMapNode> {
  return scene.root.getChildren() as ReadonlyArray<TileMapNode>;
}

describe("TileMapRenderSystem", () => {
  it("mounts one TileMapNode per layer and fills instances from set cells", () => {
    const { world, scene, system } = setup();
    const tileset: TileSet = makeTileSet();

    const grid: Entity = world.createEntity();
    world.addComponent(grid, Grid, new Vec2(128, 128));

    const layer: Entity = world.createEntity();
    world.addComponent(layer, WorldTransform2D).matrix.fromTransform2D(new Transform2D());
    const map: TileMap = world.addComponent(layer, TileMap, tileset);
    const renderer: TileMapRenderer = world.addComponent(layer, TileMapRenderer, 7);
    world.setParent(layer, grid);

    map.fill(0, 0, 1, 1, 0);

    system.update({ world, dt: 0 });

    expect(nodes(scene).length).toBe(1);
    const node: TileMapNode = nodes(scene)[0];
    expect(node.instances.length).toBe(4);
    expect(node.zIndex).toBe(7);
    expect(node.texture).toBe(tileset.texture);
    expect(renderer.sortingOrder).toBe(7);
  });

  it("skips a layer that has no Grid parent", () => {
    const { world, scene, system } = setup();
    const tileset: TileSet = makeTileSet();

    const layer: Entity = world.createEntity();
    world.addComponent(layer, WorldTransform2D).matrix.fromTransform2D(new Transform2D());
    const map: TileMap = world.addComponent(layer, TileMap, tileset);
    world.addComponent(layer, TileMapRenderer);
    map.setTile(0, 0, 0);

    system.update({ world, dt: 0 });

    expect(nodes(scene).length).toBe(0);
  });

  it("unmounts the node when asked", () => {
    const { world, scene, system } = setup();
    const tileset: TileSet = makeTileSet();

    const grid: Entity = world.createEntity();
    world.addComponent(grid, Grid, new Vec2(128, 128));
    const layer: Entity = world.createEntity();
    world.addComponent(layer, WorldTransform2D).matrix.fromTransform2D(new Transform2D());
    world.addComponent(layer, TileMap, tileset).setTile(0, 0, 0);
    world.addComponent(layer, TileMapRenderer);
    world.setParent(layer, grid);

    system.update({ world, dt: 0 });
    expect(nodes(scene).length).toBe(1);

    system.unmount(layer);
    expect(nodes(scene).length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/tilemap-render-system.test.ts`
Expected: FAIL — `Cannot find module '../src/systems'` export `TileMapRenderSystem` (ou `TileMapNode` absent de nebula si le build Task 7 n'a pas tourné).

- [ ] **Step 3: Write `TileMapRenderSystem` (toutes les cellules, sans culling)**

```ts
// packages/gameplay/src/systems/TileMapRenderSystem.ts
import { Vec2, Vec4 } from "@atlasjs/math";
import { NebulaRenderer, TileInstance, TileMapNode } from "@atlasjs/nebula";
import {
  Entity,
  NexusSystem,
  NexusSystemContext,
  NexusWorld,
} from "@atlasjs/nexus";
import { Tile } from "../assets/Tile";
import { Grid } from "../components/Grid";
import { TileMap } from "../components/TileMap";
import { TileMapRenderer } from "../components/TileMapRenderer";
import { WorldTransform2D } from "../components/WorldTransform2D";
import { cellOrigin } from "./tilemap-geometry";

export class TileMapRenderSystem implements NexusSystem {
  private readonly nebula: NebulaRenderer;
  private readonly nodes: Map<Entity, TileMapNode>;
  private readonly positionScratch: Vec2;
  private readonly scaleScratch: Vec2;

  public constructor(nebula: NebulaRenderer) {
    this.nebula = nebula;
    this.nodes = new Map<Entity, TileMapNode>();
    this.positionScratch = new Vec2();
    this.scaleScratch = new Vec2();
  }

  public update({ world }: NexusSystemContext): void {
    world
      .query(WorldTransform2D, TileMap, TileMapRenderer)
      .each(
        (
          entity: Entity,
          worldTransform: WorldTransform2D,
          tileMap: TileMap,
          renderer: TileMapRenderer,
        ) => {
          const grid: Grid | undefined = this.resolveGrid(world, entity);
          if (grid === undefined) {
            return;
          }

          const node: TileMapNode = this.resolveNode(entity);
          this.syncNode(node, worldTransform, renderer, tileMap);
          this.rebuildInstances(node, grid, tileMap);
        },
      );
  }

  public unmount(entity: Entity): void {
    const node: TileMapNode | undefined = this.nodes.get(entity);
    if (node === undefined) {
      return;
    }
    node.removeFromParent();
    this.nodes.delete(entity);
  }

  private resolveGrid(world: NexusWorld, entity: Entity): Grid | undefined {
    const parent: Entity | undefined = world.getParent(entity);
    if (parent === undefined) {
      return undefined;
    }
    return world.getComponent(parent, Grid);
  }

  private resolveNode(entity: Entity): TileMapNode {
    let node: TileMapNode | undefined = this.nodes.get(entity);
    if (node === undefined) {
      node = new TileMapNode();
      this.nebula.scene.addChild(node);
      this.nodes.set(entity, node);
    }
    return node;
  }

  private syncNode(
    node: TileMapNode,
    worldTransform: WorldTransform2D,
    renderer: TileMapRenderer,
    tileMap: TileMap,
  ): void {
    const position: Vec2 = worldTransform.getPosition(this.positionScratch);
    const scale: Vec2 = worldTransform.getScale(this.scaleScratch);

    node.setPosition(position.x, position.y);
    node.setRotation(worldTransform.getRotation());
    node.setScale(scale.x, scale.y);

    node.texture = tileMap.tileset.texture;
    node.tint.set(
      renderer.color.r,
      renderer.color.g,
      renderer.color.b,
      renderer.color.a,
    );
    node.zIndex = renderer.sortingOrder;
    node.visible = renderer.visible;
  }

  private rebuildInstances(node: TileMapNode, grid: Grid, tileMap: TileMap): void {
    const instances: TileInstance[] = node.instances;
    instances.length = 0;

    const textureWidth: number = tileMap.tileset.texture.width;
    const textureHeight: number = tileMap.tileset.texture.height;

    tileMap.forEachTile((cx: number, cy: number, index: number) => {
      const tile: Tile | undefined = tileMap.tileset.tryGetTile(index);
      if (tile === undefined) {
        return;
      }

      const origin: { x: number; y: number } = cellOrigin(
        grid.cellSize,
        grid.cellGap,
        cx,
        cy,
      );
      const rect = tile.sprite.rect;

      instances.push({
        x: origin.x,
        y: origin.y,
        width: rect.width,
        height: rect.height,
        uvRect: new Vec4(
          rect.x / textureWidth,
          rect.y / textureHeight,
          rect.width / textureWidth,
          rect.height / textureHeight,
        ),
      });
    });
  }
}
```

- [ ] **Step 4: Export from the systems barrel**

Dans `packages/gameplay/src/systems/index.ts`, ajouter :

```ts
export * from "./TileMapRenderSystem";
```

- [ ] **Step 5: Wire it into `GameplayPlugin`**

Dans `packages/gameplay/src/GameplayPlugin.ts` :
- Ajouter `TileMapRenderSystem` à l'import groupé depuis `"./systems"`.
- Ajouter `Grid`, `TileMap`, `TileMapRenderer` à l'import groupé depuis `"./components"`.
- Dans `install`, construire le système près des autres :

```ts
    const tileMapRenderSystem: TileMapRenderSystem = new TileMapRenderSystem(nebula);
```

- Ajouter à la chaîne de `defineComponent` :

```ts
      .defineComponent(Grid)
      .defineComponent(TileMap)
      .defineComponent(TileMapRenderer);
```

- Ajouter dans le `this.unsubscribers.push(...)` (à côté du `onRemove(SpriteRender, ...)`) :

```ts
      world.onRemove(TileMap, (entity: Entity) => {
        tileMapRenderSystem.unmount(entity);
      }),
```

- Enregistrer le système dans la lane `render`, après `gameplay:sprite-render` :

```ts
    this.handles.push(
      registerSystem(render, world, tileMapRenderSystem, {
        name: "gameplay:tilemap-render",
        stage: "PreRender",
        after: "gameplay:sprite-render",
      }),
    );
```

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/tilemap-render-system.test.ts`
Expected: PASS (3 tests).
Run: `pnpm --filter @atlasjs/gameplay run typecheck`
Expected: no errors.

- [ ] **Step 7: Review & commit checkpoint**

STOP. Diff → relecture → commit.
Suggested message: `feat(gameplay): add TileMapRenderSystem + GameplayPlugin wiring`

---

## Task 9: culling au viewport dans `TileMapRenderSystem`

**Files:**
- Modify: `packages/gameplay/src/systems/TileMapRenderSystem.ts`
- Test: `packages/gameplay/test/tilemap-render-system.test.ts` (ajouter un cas)

**Interfaces:**
- Consumes (nouveau) : `Bound`/`Mat3` (`@atlasjs/math`), `visibleCellRange`/`worldBoundToLocalBound`/`CellRange` (Task 5).

- [ ] **Step 1: Write the failing test (append)**

Ajouter dans `describe("TileMapRenderSystem", ...)` :

```ts
  it("culls cells outside the camera viewport", () => {
    const { world, scene, system } = setup(new Bound(-64, -64, 256, 256));
    const tileset: TileSet = makeTileSet();

    const grid: Entity = world.createEntity();
    world.addComponent(grid, Grid, new Vec2(128, 128));
    const layer: Entity = world.createEntity();
    world.addComponent(layer, WorldTransform2D).matrix.fromTransform2D(new Transform2D());
    const map: TileMap = world.addComponent(layer, TileMap, tileset);
    world.addComponent(layer, TileMapRenderer);
    world.setParent(layer, grid);

    map.setTile(0, 0, 0);
    map.setTile(100, 100, 0);

    system.update({ world, dt: 0 });

    const node: TileMapNode = nodes(scene)[0];
    expect(node.instances.length).toBe(1);
    expect(node.instances[0].x).toBe(0);
    expect(node.instances[0].y).toBe(0);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/tilemap-render-system.test.ts`
Expected: FAIL — le nouveau cas attend 1 instance, l'implémentation actuelle en émet 2 (pas de culling).

- [ ] **Step 3: Replace `rebuildInstances` with viewport-culled iteration**

Dans `TileMapRenderSystem.ts` :
- Étendre les imports :

```ts
import { Bound, Mat3, Vec2, Vec4 } from "@atlasjs/math";
```
```ts
import {
  CellRange,
  cellOrigin,
  visibleCellRange,
  worldBoundToLocalBound,
} from "./tilemap-geometry";
```

- Remplacer la signature d'appel dans `update` pour passer le `worldTransform` à `rebuildInstances` :

```ts
          this.rebuildInstances(node, grid, tileMap, worldTransform);
```

- Remplacer entièrement la méthode `rebuildInstances` :

```ts
  private rebuildInstances(
    node: TileMapNode,
    grid: Grid,
    tileMap: TileMap,
    worldTransform: WorldTransform2D,
  ): void {
    const instances: TileInstance[] = node.instances;
    instances.length = 0;

    const textureWidth: number = tileMap.tileset.texture.width;
    const textureHeight: number = tileMap.tileset.texture.height;

    const viewport: Bound = this.nebula.getCameraViewport();
    const invWorld: Mat3 = worldTransform.matrix.clone().invert();
    const localViewport: Bound = worldBoundToLocalBound(invWorld, viewport);
    const range: CellRange = visibleCellRange(grid.cellSize, grid.cellGap, localViewport);

    for (let cy: number = range.cyMin; cy <= range.cyMax; cy++) {
      for (let cx: number = range.cxMin; cx <= range.cxMax; cx++) {
        const index: number = tileMap.getTile(cx, cy);
        if (index < 0) {
          continue;
        }

        const tile: Tile | undefined = tileMap.tileset.tryGetTile(index);
        if (tile === undefined) {
          continue;
        }

        const origin: { x: number; y: number } = cellOrigin(
          grid.cellSize,
          grid.cellGap,
          cx,
          cy,
        );
        const rect = tile.sprite.rect;

        instances.push({
          x: origin.x,
          y: origin.y,
          width: rect.width,
          height: rect.height,
          uvRect: new Vec4(
            rect.x / textureWidth,
            rect.y / textureHeight,
            rect.width / textureWidth,
            rect.height / textureHeight,
          ),
        });
      }
    }
  }
```

- [ ] **Step 4: Run the full system suite**

Run: `pnpm --filter @atlasjs/gameplay exec vitest run test/tilemap-render-system.test.ts`
Expected: PASS (4 tests — culling inclus, les 3 précédents restent verts car leur viewport est large).

- [ ] **Step 5: Review & commit checkpoint**

STOP. Diff → relecture → commit.
Suggested message: `feat(gameplay): viewport-cull tilemap cells in TileMapRenderSystem`

---

## Task 10: réécriture du sandbox + vérification navigateur

**Files:**
- Modify: `apps/sandbox/src/game/EcsScene.ts`

**Interfaces:**
- Consumes: `TileSetAsset`/`TileSet`/`Grid`/`TileMap`/`TileMapRenderer` (`@atlasjs/gameplay`), `Vec2` (`@atlasjs/math`).

- [ ] **Step 1: Rebuild gameplay + nebula so the app resolves the new API**

Run: `pnpm --filter @atlasjs/nebula build && pnpm --filter @atlasjs/gameplay build`
Expected: builds OK.

- [ ] **Step 2: Replace the manual tile loop**

Dans `apps/sandbox/src/game/EcsScene.ts` :
- Ajouter aux imports valeur depuis `@atlasjs/gameplay` : `Grid`, `TileMap`, `TileMapRenderer`, `TileSet`, `TileSetAsset`.
- Ajouter `Vec2` à l'import depuis `@atlasjs/math` (`import { Bound, Vec2 } from "@atlasjs/math";`).
- Supprimer la double boucle `for (let y...) { for (let x...) { ... } }` (lignes ~135–148) **et** le chargement devenu inutile `grassTilesetTexture` s'il n'est plus référencé ailleurs.
- Charger le tileset et construire la grille :

```ts
    const grassTileset: TileSet = await assets.load<TileSet>(
      TileSetAsset.fromPath(GrassTileset, { tileWidth: 128, tileHeight: 128 }),
    );

    const grid: Entity = nexus.createEntity();
    nexus.addComponent(grid, Grid, new Vec2(128, 128));            // cellSize = TAILLE NATIVE de la tuile
    const gridTransform: Transform2D = nexus.addComponent(grid, Transform2D);
    gridTransform.scale.set(2.5, 2.5);                            // agrandissement via le scale de la Grid (se propage au calque)

    const ground: Entity = nexus.createEntity();
    const groundMap: TileMap = nexus.addComponent(ground, TileMap, grassTileset);
    nexus.addComponent(ground, TileMapRenderer, 0);
    nexus.addComponent(ground, Transform2D);
    nexus.setParent(ground, grid);

    groundMap.fill(0, 0, 9, 9, grassTileset.indexOf(0, 1));
```

> **ERRATUM (corrigé après vérif navigateur)** : une version antérieure de cet exemple mettait `cellSize = new Vec2(128 * 2.5, 128 * 2.5)` avec un scale de Grid à 1 — **c'est faux** et ça laisse des trous noirs (192px) entre les tuiles. Les tuiles sont dessinées à leur **taille native (128px)** ; donc `cellSize` doit **égaler la taille native** (`128`) pour un tiling jointif, et l'agrandissement se fait via le **`scale` du `Transform2D` de la `Grid`** (qui se propage au calque). Cf. la note de rendu en tête de [`tilemap.md`](tilemap.md). Le *fit-to-cell scaling* (découpler taille de rendu et taille native) est au backlog.
>
> Note tuile : l'ancien sandbox dessinait la région source `(0,128,128,128)` = `(col 0, row 1)` d'un tileset en tuiles de 128 → `indexOf(0, 1)`. Ajuster selon la découpe réelle de `grass.png`.

- [ ] **Step 3: Typecheck the app**

Run: `pnpm --filter @atlasjs/gameplay run typecheck` puis, à la racine, `pnpm exec turbo run build --filter=sandbox` (ou `pnpm --filter sandbox build`).
Expected: pas d'erreur de type ; en particulier aucun symbole type-only importé en import valeur (sinon Vite cassera au runtime).

- [ ] **Step 4: Browser verification (obligatoire)**

1. `preview_start` le serveur dev du sandbox (via `.claude/launch.json`, sinon le créer pour `pnpm --filter sandbox dev`).
2. `read_console_messages` (onlyErrors) → aucune erreur ; pas d'écran noir (signe d'un import type-only mal fait).
3. `computer {action:"screenshot"}` → la grille d'herbe 10×10 s'affiche, le joueur et l'épée par-dessus (sortingOrder du sprite ≥ celui du calque sol).
4. `read_network_requests` → `grass.png` chargé une fois.
5. Si un calque supplémentaire est ajouté pour tester le multi-couche, vérifier l'ordre de tri visuel.

Corriger tout problème en éditant la source, puis re-vérifier depuis l'étape 2.

- [ ] **Step 5: Full test gate**

Run: `pnpm exec turbo run test --filter=@atlasjs/gameplay --filter=@atlasjs/nebula`
Expected: toutes les suites PASS (turbo rebuild nebula avant les tests gameplay).

- [ ] **Step 6: Review & commit checkpoint**

STOP. Présenter le diff + la capture d'écran. L'utilisateur relit et committe.
Suggested message: `feat(sandbox): use TileSet/Grid/TileMap for the ground layer`

---

## Self-Review (rempli à l'écriture du plan)

**Spec coverage :** TileSet asset (T1–T2) ✓ · Grid/TileMap/TileMapRenderer (T3–T4) ✓ · géométrie cellule↔monde + culling (T5, T9) ✓ · TileMapNode + kind + DrawCommand (T6) ✓ · NodeRenderer + Batcher + registration (T7) ✓ · système + câblage plugin + onRemove (T8) ✓ · multi-calque (structure Grid→enfants exercée en T8/T10) ✓ · sortingOrder→zIndex (T7 sortKey, T8 sync) ✓ · exemple code-first + vérif navigateur (T10) ✓ · placement coin d'origine, taille native (T7 model math) ✓.

**Type consistency :** `TileSet.getTile/tryGetTile/indexOf/count`, `TileMap.setTile/getTile/hasTile/removeTile/fill/clear/forEachTile/revision`, `TileMapRenderer.sortingOrder/color/visible`, `Grid.cellSize/cellGap`, `TileMapNode.texture/tint/instances`, `TileInstance{x,y,width,height,uvRect}`, `cellOrigin/visibleCellRange/worldBoundToLocalBound` — noms/signatures identiques entre tâches productrices et consommatrices.

**Placeholder scan :** aucun `TBD`/`TODO`/code omis ; chaque étape de code montre le code complet.
