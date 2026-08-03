# Occluders & Y-sort — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un occluder plus grand qu'une tuile (mur, arbre, bâtiment) de passer correctement devant *ou* derrière le joueur, en le décomposant en **strips** triés par `footY` dans la couche `ySorted`.

**Architecture :** Un occluder = N strips (bandes à une seule ligne de pieds). Chaque strip = un `TileMapNode` (sac d'instances de tuiles, 1 texture, 1 sort key = `footY`) posé dans la couche `Entities` (ySorted), à côté du joueur. Package `@atlasjs/gameplay` : composant `OccluderStrip` + `OccluderRenderSystem` + baker pur `bakeOccluderStrips`. App dino-brawl : `MapBuilder` étendu ingère le calque `Occluders_*` + les rectangles `OccluderRegions`.

**Tech Stack :** TypeScript, Turborepo/pnpm, Vitest, Nexus ECS, Nebula (renderer), WebGPU (preview).

**Design de référence :** [`occluder-ysort.md`](occluder-ysort.md).

## Global Constraints

- **Typage strict, sans commentaires** : typer chaque variable/paramètre (même trivial) ; ne pas ajouter de commentaires dans le code (convention repo).
- **Ne PAS commiter automatiquement** : chaque tâche se termine par un `git add` qui laisse les changements **stagés** ; l'utilisateur review et commit lui-même. La tâche suivante re-vérifie ses tests contre le **HEAD commité par l'utilisateur** (il peut éditer au moment du commit).
- **Typecheck** : `tsc --noEmit` (jamais `tsc -b` — émet des artefacts à côté des sources).
- **Build gameplay** : `pnpm --filter @atlasjs/gameplay build` ; **test** : `pnpm --filter @atlasjs/gameplay test`.
- **Vite / app** : dans `apps/dino-brawl`, tout symbole purement type-only doit être importé en `import type` (sinon `tsc` passe mais Vite casse au runtime → écran noir).
- **Rebuild du `dist` d'une dépendance** dont l'API publique change (ici `@atlasjs/gameplay`) avant de typecheck/preview l'app.
- **Couche ySorted** : seule `Entities` est en mode `ySorted` (défini par l'app). Les strips y vont par défaut.

## Raffinements du design (à répercuter dans `occluder-ysort.md` après coup)

- **Culling reporté** : v1 ne cull pas les strips (peu nombreux, statiques) → backlog. (Décision C du doc allégée.)
- **Discriminant d'un occluder** : un rect est une région d'occluder ssi son `groupPath` inclut `"OccluderRegions"` **ou** sa propriété `occluder === true`.
- **Calques de tuiles occluder** : nommés avec le préfixe `Occluders` (ex. `Occluders_Trees`, `Occluders_Walls`). Construits normalement puis leur `TileMapRenderer` est retiré (pas de rendu à plat).
- **`footY` d'un `slice: "single"`** = bord bas monde du rectangle (contrôle artiste). Pour `perRow`, `footY` par rangée = bas monde de la cellule.

## File Structure

- **Create** `packages/gameplay/src/components/OccluderStrip.ts` — le composant LEVEL 1 (donnée bakée).
- **Create** `packages/gameplay/src/occluders/bakeOccluderStrips.ts` — baker pur + types `OccluderRegion`/`OccluderStripData`.
- **Create** `packages/gameplay/src/systems/OccluderRenderSystem.ts` — monte 1 `TileMapNode`/strip, trie par `footY`.
- **Modify** `packages/gameplay/src/GameplayPlugin.ts` — `defineComponent(OccluderStrip)`, register system, `onRemove`.
- **Modify** `packages/gameplay/src/index.ts` — barrel exports.
- **Create** `packages/gameplay/test/bake-occluder-strips.test.ts`, `packages/gameplay/test/occluder-render-system.test.ts`.
- **Create** `apps/dino-brawl/src/game/tiled/ingestOccluders.ts` — Tiled → strips.
- **Modify** `apps/dino-brawl/src/game/tiled/MapBuilder.ts` — brancher l'ingestion.

---

### Task 1: Composant `OccluderStrip`

**Files:**
- Create: `packages/gameplay/src/components/OccluderStrip.ts`
- Test: `packages/gameplay/test/occluder-strip.test.ts`

**Interfaces:**
- Consumes: `TileInstance`, `Texture2D` (`@atlasjs/nebula`).
- Produces: `class OccluderStrip { footY: number; tiles: TileInstance[]; texture: Texture2D; sortingLayer: string; constructor(footY, tiles, texture, sortingLayer) }`.

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// packages/gameplay/test/occluder-strip.test.ts
import { describe, expect, it } from "vitest";
import { Vec4 } from "@atlasjs/math";
import type { TileInstance, Texture2D } from "@atlasjs/nebula";
import { OccluderStrip } from "../src/components/OccluderStrip";

describe("OccluderStrip", () => {
  it("stocke footY, tiles, texture et sortingLayer", () => {
    const texture: Texture2D = { width: 128, height: 128 } as unknown as Texture2D;
    const tiles: TileInstance[] = [
      { x: 0, y: 0, width: 32, height: 32, uvRect: new Vec4(0, 0, 0.25, 0.25) },
    ];
    const strip: OccluderStrip = new OccluderStrip(160, tiles, texture, "Entities");
    expect(strip.footY).toBe(160);
    expect(strip.tiles).toBe(tiles);
    expect(strip.texture).toBe(texture);
    expect(strip.sortingLayer).toBe("Entities");
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `pnpm --filter @atlasjs/gameplay test bake-occluder-strips 2>/dev/null; pnpm --filter @atlasjs/gameplay test occluder-strip`
Expected: FAIL — `Cannot find module '../src/components/OccluderStrip'`.

- [ ] **Step 3 : Implémenter le composant**

```ts
// packages/gameplay/src/components/OccluderStrip.ts
import type { TileInstance, Texture2D } from "@atlasjs/nebula";

export class OccluderStrip {
  public footY: number;
  public tiles: TileInstance[];
  public texture: Texture2D;
  public sortingLayer: string;

  public constructor(
    footY: number,
    tiles: TileInstance[],
    texture: Texture2D,
    sortingLayer: string,
  ) {
    this.footY = footY;
    this.tiles = tiles;
    this.texture = texture;
    this.sortingLayer = sortingLayer;
  }
}
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `pnpm --filter @atlasjs/gameplay test occluder-strip`
Expected: PASS.

- [ ] **Step 5 : Stager pour review**

```bash
git add packages/gameplay/src/components/OccluderStrip.ts packages/gameplay/test/occluder-strip.test.ts
```
→ Laisse stagé. L'utilisateur review et commit.

---

### Task 2: Baker pur `bakeOccluderStrips`

**Files:**
- Create: `packages/gameplay/src/occluders/bakeOccluderStrips.ts`
- Test: `packages/gameplay/test/bake-occluder-strips.test.ts`

**Interfaces:**
- Consumes: `TileMap` (`../components/TileMap` — `getTile(cx,cy): number` renvoie -1 si vide, `tileset.tryGetTile(index): Tile | undefined`, `tileset.texture`), `cellOrigin`/`CellRange` (`../systems/utils/tilemap-geometry`), `Vec2`/`Vec4`/`Bound` (`@atlasjs/math`), `TileInstance`/`Texture2D` (`@atlasjs/nebula`).
- Produces:
  - `interface OccluderStripData { footY: number; tiles: TileInstance[]; texture: Texture2D; sortingLayer: string }`
  - `interface OccluderRegion { cellBounds: CellRange; slice: "single" | "perRow"; sortingLayer: string; footYWorld: number; rowFootYWorld: (cy: number) => number }`
  - `function bakeOccluderStrips(region: OccluderRegion, layer: TileMap, cellSize: Vec2, cellGap: Vec2): OccluderStripData[]`

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
// packages/gameplay/test/bake-occluder-strips.test.ts
import { describe, expect, it } from "vitest";
import { Bound, Vec2 } from "@atlasjs/math";
import type { Texture2D } from "@atlasjs/nebula";
import { TileMap } from "../src/components/TileMap";
import type { TileSet } from "../src/assets/TileSet";
import type { Tile } from "../src/assets/Tile";
import { bakeOccluderStrips } from "../src/occluders/bakeOccluderStrips";
import type { OccluderRegion } from "../src/occluders/bakeOccluderStrips";

function makeTileSet(): TileSet {
  const texture: Texture2D = { width: 128, height: 128 } as unknown as Texture2D;
  const tile: Tile = { index: 0, sprite: { rect: new Bound(0, 0, 32, 32) } } as unknown as Tile;
  return {
    texture,
    tryGetTile: (_index: number): Tile => tile,
    getTile: (_index: number): Tile => tile,
  } as unknown as TileSet;
}

describe("bakeOccluderStrips", () => {
  it("slice 'single' → un strip, tuiles ramassées, footY = footYWorld", () => {
    const layer: TileMap = new TileMap(makeTileSet());
    layer.setTile(0, 0, 0);
    layer.setTile(1, 0, 0);
    layer.setTile(0, 1, 0);
    layer.setTile(1, 1, 0);

    const region: OccluderRegion = {
      cellBounds: { cxMin: 0, cyMin: 0, cxMax: 1, cyMax: 1 },
      slice: "single",
      sortingLayer: "Entities",
      footYWorld: 320,
      rowFootYWorld: (cy: number): number => (cy + 1) * 64,
    };

    const strips = bakeOccluderStrips(region, layer, new Vec2(32, 32), new Vec2(0, 0));

    expect(strips.length).toBe(1);
    expect(strips[0].footY).toBe(320);
    expect(strips[0].tiles.length).toBe(4);
    expect(strips[0].sortingLayer).toBe("Entities");
    expect(strips[0].texture).toBe(layer.tileset.texture);
    expect(strips[0].tiles[0]).toMatchObject({ x: 0, y: 0, width: 32, height: 32 });
  });

  it("slice 'perRow' → un strip par rangée non vide, footY = rowFootYWorld(cy)", () => {
    const layer: TileMap = new TileMap(makeTileSet());
    layer.setTile(0, 0, 0);
    layer.setTile(1, 0, 0);
    layer.setTile(0, 2, 0);

    const region: OccluderRegion = {
      cellBounds: { cxMin: 0, cyMin: 0, cxMax: 1, cyMax: 2 },
      slice: "perRow",
      sortingLayer: "Entities",
      footYWorld: 999,
      rowFootYWorld: (cy: number): number => (cy + 1) * 64,
    };

    const strips = bakeOccluderStrips(region, layer, new Vec2(32, 32), new Vec2(0, 0));

    expect(strips.length).toBe(2);
    expect(strips[0].footY).toBe(64);
    expect(strips[0].tiles.length).toBe(2);
    expect(strips[1].footY).toBe(192);
    expect(strips[1].tiles.length).toBe(1);
  });

  it("région vide → aucun strip", () => {
    const layer: TileMap = new TileMap(makeTileSet());
    const region: OccluderRegion = {
      cellBounds: { cxMin: 0, cyMin: 0, cxMax: 2, cyMax: 2 },
      slice: "single",
      sortingLayer: "Entities",
      footYWorld: 10,
      rowFootYWorld: (cy: number): number => cy,
    };
    expect(bakeOccluderStrips(region, layer, new Vec2(32, 32), new Vec2(0, 0))).toEqual([]);
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `pnpm --filter @atlasjs/gameplay test bake-occluder-strips`
Expected: FAIL — `Cannot find module '../src/occluders/bakeOccluderStrips'`.

- [ ] **Step 3 : Implémenter le baker**

```ts
// packages/gameplay/src/occluders/bakeOccluderStrips.ts
import { Vec2, Vec4 } from "@atlasjs/math";
import type { Bound } from "@atlasjs/math";
import type { TileInstance, Texture2D } from "@atlasjs/nebula";
import type { Tile } from "../assets/Tile";
import type { TileMap } from "../components/TileMap";
import { cellOrigin } from "../systems/utils/tilemap-geometry";
import type { CellOrigin, CellRange } from "../systems/utils/tilemap-geometry";

export interface OccluderStripData {
  footY: number;
  tiles: TileInstance[];
  texture: Texture2D;
  sortingLayer: string;
}

export interface OccluderRegion {
  cellBounds: CellRange;
  slice: "single" | "perRow";
  sortingLayer: string;
  footYWorld: number;
  rowFootYWorld: (cy: number) => number;
}

export function bakeOccluderStrips(
  region: OccluderRegion,
  layer: TileMap,
  cellSize: Vec2,
  cellGap: Vec2,
): OccluderStripData[] {
  const texture: Texture2D = layer.tileset.texture;
  const texW: number = texture.width;
  const texH: number = texture.height;
  const bounds: CellRange = region.cellBounds;

  const instanceAt = (cx: number, cy: number): TileInstance | undefined => {
    const index: number = layer.getTile(cx, cy);
    if (index < 0) {
      return undefined;
    }
    const tile: Tile | undefined = layer.tileset.tryGetTile(index);
    if (tile === undefined) {
      return undefined;
    }
    const rect: Bound = tile.sprite.rect;
    const origin: CellOrigin = cellOrigin(cellSize, cellGap, cx, cy);
    return {
      x: origin.x,
      y: origin.y,
      width: rect.width,
      height: rect.height,
      uvRect: new Vec4(rect.x / texW, rect.y / texH, rect.width / texW, rect.height / texH),
    };
  };

  const rowTiles = (cy: number): TileInstance[] => {
    const tiles: TileInstance[] = [];
    for (let cx: number = bounds.cxMin; cx <= bounds.cxMax; cx++) {
      const inst: TileInstance | undefined = instanceAt(cx, cy);
      if (inst !== undefined) {
        tiles.push(inst);
      }
    }
    return tiles;
  };

  if (region.slice === "single") {
    const tiles: TileInstance[] = [];
    for (let cy: number = bounds.cyMin; cy <= bounds.cyMax; cy++) {
      tiles.push(...rowTiles(cy));
    }
    if (tiles.length === 0) {
      return [];
    }
    return [{ footY: region.footYWorld, tiles, texture, sortingLayer: region.sortingLayer }];
  }

  const out: OccluderStripData[] = [];
  for (let cy: number = bounds.cyMin; cy <= bounds.cyMax; cy++) {
    const tiles: TileInstance[] = rowTiles(cy);
    if (tiles.length === 0) {
      continue;
    }
    out.push({
      footY: region.rowFootYWorld(cy),
      tiles,
      texture,
      sortingLayer: region.sortingLayer,
    });
  }
  return out;
}
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Run: `pnpm --filter @atlasjs/gameplay test bake-occluder-strips`
Expected: PASS (3 tests).

- [ ] **Step 5 : Stager pour review**

```bash
git add packages/gameplay/src/occluders/bakeOccluderStrips.ts packages/gameplay/test/bake-occluder-strips.test.ts
```

---

### Task 3: `OccluderRenderSystem`

**Files:**
- Create: `packages/gameplay/src/systems/OccluderRenderSystem.ts`
- Test: `packages/gameplay/test/occluder-render-system.test.ts`

**Interfaces:**
- Consumes: `OccluderStrip` (Task 1), `WorldTransform2D` (`../components/WorldTransform2D`), `applySortFields` (`../rendering/applySortFields`), `SortingLayers` (`../rendering`), `TileMapNode`/`NebulaRenderer` (`@atlasjs/nebula`), `Vec2` (`@atlasjs/math`), `Entity`/`NexusSystem`/`NexusSystemContext` (`@atlasjs/nexus`).
- Produces: `class OccluderRenderSystem implements NexusSystem { constructor(nebula, sortingLayers); update(ctx); unmount(entity) }`.

- [ ] **Step 1 : Écrire les tests qui échouent** (calqués sur `tilemap-render-system.test.ts` : monde nu + `SceneGraph` + stub `NebulaRenderer`, avancée par `system.update({ world, dt: 0 })`, inspection via `scene.root.getChildren()`).

```ts
// packages/gameplay/test/occluder-render-system.test.ts
import { describe, expect, it } from "vitest";
import { Transform2D, Vec4 } from "@atlasjs/math";
import { SceneGraph, TileMapNode } from "@atlasjs/nebula";
import type { NebulaRenderer, TileInstance, Texture2D } from "@atlasjs/nebula";
import { NexusWorld } from "@atlasjs/nexus";
import type { Entity } from "@atlasjs/nexus";
import { WorldTransform2D } from "../src/components/WorldTransform2D";
import { OccluderStrip } from "../src/components/OccluderStrip";
import { SortingLayers } from "../src/rendering/SortingLayers";
import { OccluderRenderSystem } from "../src/systems/OccluderRenderSystem";

function setup(): { world: NexusWorld; scene: SceneGraph; system: OccluderRenderSystem } {
  const world: NexusWorld = new NexusWorld();
  world.defineComponent(WorldTransform2D).defineComponent(OccluderStrip);

  const scene: SceneGraph = new SceneGraph();
  const nebula: NebulaRenderer = { scene } as unknown as NebulaRenderer;

  const layers: SortingLayers = new SortingLayers();
  layers.define([{ name: "Entities", mode: "ySorted" }]);

  return { world, scene, system: new OccluderRenderSystem(nebula, layers) };
}

function nodes(scene: SceneGraph): ReadonlyArray<TileMapNode> {
  return scene.root.getChildren() as ReadonlyArray<TileMapNode>;
}

function texture(): Texture2D {
  return { width: 128, height: 128 } as unknown as Texture2D;
}

function tiles(): TileInstance[] {
  return [{ x: 0, y: 0, width: 32, height: 32, uvRect: new Vec4(0, 0, 0.25, 0.25) }];
}

describe("OccluderRenderSystem", () => {
  it("monte un TileMapNode par strip, trié par footY (couche ySorted)", () => {
    const { world, scene, system } = setup();
    const strip: TileInstance[] = tiles();
    const tex: Texture2D = texture();

    const e: Entity = world.createEntity();
    world.addComponent(e, WorldTransform2D).matrix.fromTransform2D(new Transform2D());
    world.addComponent(e, OccluderStrip, 160, strip, tex, "Entities");

    system.update({ world, dt: 0 });

    expect(nodes(scene).length).toBe(1);
    const node: TileMapNode = nodes(scene)[0];
    expect(node.instances).toBe(strip);
    expect(node.texture).toBe(tex);
    expect(node.sortPrimary).toBe(160);
  });

  it("hérite l'échelle du WorldTransform2D", () => {
    const { world, scene, system } = setup();
    const t: Transform2D = new Transform2D();
    t.scale.set(2, 2);

    const e: Entity = world.createEntity();
    world.addComponent(e, WorldTransform2D).matrix.fromTransform2D(t);
    world.addComponent(e, OccluderStrip, 10, tiles(), texture(), "Entities");

    system.update({ world, dt: 0 });

    expect(nodes(scene)[0].transform.scale.x).toBe(2);
  });

  it("ne reconstruit pas les instances entre deux frames (statique)", () => {
    const { world, scene, system } = setup();
    const strip: TileInstance[] = tiles();

    const e: Entity = world.createEntity();
    world.addComponent(e, WorldTransform2D).matrix.fromTransform2D(new Transform2D());
    world.addComponent(e, OccluderStrip, 5, strip, texture(), "Entities");

    system.update({ world, dt: 0 });
    system.update({ world, dt: 0 });

    expect(nodes(scene).length).toBe(1);
    expect(nodes(scene)[0].instances).toBe(strip);
  });

  it("unmount retire le node de la scène", () => {
    const { world, scene, system } = setup();
    const e: Entity = world.createEntity();
    world.addComponent(e, WorldTransform2D).matrix.fromTransform2D(new Transform2D());
    world.addComponent(e, OccluderStrip, 5, tiles(), texture(), "Entities");

    system.update({ world, dt: 0 });
    expect(nodes(scene).length).toBe(1);

    system.unmount(e);
    expect(nodes(scene).length).toBe(0);
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `pnpm --filter @atlasjs/gameplay test occluder-render-system`
Expected: FAIL — `Cannot find module '../src/systems/OccluderRenderSystem'`.

- [ ] **Step 3 : Implémenter le système** (calqué sur `TileMapRenderSystem.syncNode`, mais instances posées **une fois** au montage et tri par `footY`).

```ts
// packages/gameplay/src/systems/OccluderRenderSystem.ts
import { Vec2 } from "@atlasjs/math";
import { TileMapNode } from "@atlasjs/nebula";
import type { NebulaRenderer } from "@atlasjs/nebula";
import { applySortFields } from "../rendering/applySortFields";
import type { SortingLayers } from "../rendering";
import { OccluderStrip } from "../components/OccluderStrip";
import { WorldTransform2D } from "../components/WorldTransform2D";
import type {
  Entity,
  NexusSystem,
  NexusSystemContext,
} from "@atlasjs/nexus";

export class OccluderRenderSystem implements NexusSystem {
  private readonly nebula: NebulaRenderer;
  private readonly sortingLayers: SortingLayers;
  private readonly nodes: Map<Entity, TileMapNode>;
  private readonly positionScratch: Vec2;
  private readonly scaleScratch: Vec2;

  public constructor(nebula: NebulaRenderer, sortingLayers: SortingLayers) {
    this.nebula = nebula;
    this.sortingLayers = sortingLayers;
    this.nodes = new Map<Entity, TileMapNode>();
    this.positionScratch = new Vec2();
    this.scaleScratch = new Vec2();
  }

  // prettier-ignore
  public update({ world }: NexusSystemContext): void {
    world
      .query(WorldTransform2D, OccluderStrip)
      .each((entity: Entity, worldTransform: WorldTransform2D, strip: OccluderStrip) => {
        const node: TileMapNode = this.resolveNode(entity, strip);

        const position: Vec2 = worldTransform.getPosition(this.positionScratch);
        const scale: Vec2 = worldTransform.getScale(this.scaleScratch);

        node.setPosition(position.x, position.y);
        node.setRotation(worldTransform.getRotation());
        node.setScale(scale.x, scale.y);

        applySortFields(node, this.sortingLayers, strip.sortingLayer, 0, strip.footY);
      });
  }

  public unmount(entity: Entity): void {
    const node: TileMapNode | undefined = this.nodes.get(entity);
    if (node === undefined) {
      return;
    }
    node.removeFromParent();
    this.nodes.delete(entity);
  }

  private resolveNode(entity: Entity, strip: OccluderStrip): TileMapNode {
    let node: TileMapNode | undefined = this.nodes.get(entity);
    if (node === undefined) {
      node = new TileMapNode();
      node.texture = strip.texture;
      node.instances = strip.tiles;
      this.nebula.scene.addChild(node);
      this.nodes.set(entity, node);
    }
    return node;
  }
}
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Run: `pnpm --filter @atlasjs/gameplay test occluder-render-system`
Expected: PASS (4 tests).

- [ ] **Step 5 : Stager pour review**

```bash
git add packages/gameplay/src/systems/OccluderRenderSystem.ts packages/gameplay/test/occluder-render-system.test.ts
```

---

### Task 4: Câblage `GameplayPlugin` + barrel

**Files:**
- Modify: `packages/gameplay/src/GameplayPlugin.ts`
- Modify: `packages/gameplay/src/index.ts`
- Test: `packages/gameplay/test/occluder-plugin.test.ts`

**Interfaces:**
- Consumes: `OccluderStrip` (Task 1), `OccluderRenderSystem` (Task 3), `bakeOccluderStrips`/`OccluderRegion`/`OccluderStripData` (Task 2), `createHarness` (`./helpers/harness`), `NEBULA_RENDERER` (`@atlasjs/nebula`).
- Produces: barrel exports depuis `@atlasjs/gameplay` ; le plugin définit `OccluderStrip`, enregistre `OccluderRenderSystem` au stage `PreRender` de la lane `render`, et branche `onRemove(OccluderStrip → system.unmount)`.

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// packages/gameplay/test/occluder-plugin.test.ts
import { describe, expect, it } from "vitest";
import { Vec4 } from "@atlasjs/math";
import type { TileInstance, Texture2D } from "@atlasjs/nebula";
import { OccluderStrip, bakeOccluderStrips } from "@atlasjs/gameplay";
import { createHarness } from "./helpers/harness";
import type { Harness } from "./helpers/harness";

describe("GameplayPlugin — occluders", () => {
  it("exporte OccluderStrip et bakeOccluderStrips depuis le barrel", () => {
    expect(typeof OccluderStrip).toBe("function");
    expect(typeof bakeOccluderStrips).toBe("function");
  });

  it("définit le composant OccluderStrip (addComponent ne throw pas)", async () => {
    const h: Harness = await createHarness();
    const texture: Texture2D = { width: 64, height: 64 } as unknown as Texture2D;
    const tiles: TileInstance[] = [
      { x: 0, y: 0, width: 32, height: 32, uvRect: new Vec4(0, 0, 0.5, 0.5) },
    ];
    const e = h.world.createEntity();
    expect(() => h.world.addComponent(e, OccluderStrip, 12, tiles, texture, "Entities")).not.toThrow();
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `pnpm --filter @atlasjs/gameplay build && pnpm --filter @atlasjs/gameplay test occluder-plugin`
Expected: FAIL — `OccluderStrip`/`bakeOccluderStrips` non exportés (import error) ou composant non défini.

- [ ] **Step 3 : Ajouter les exports au barrel**

Dans `packages/gameplay/src/index.ts`, à côté des exports de `TileMap`/`TileMapRenderSystem`, ajouter :

```ts
export { OccluderStrip } from "./components/OccluderStrip";
export { OccluderRenderSystem } from "./systems/OccluderRenderSystem";
export { bakeOccluderStrips } from "./occluders/bakeOccluderStrips";
export type { OccluderRegion, OccluderStripData } from "./occluders/bakeOccluderStrips";
```

- [ ] **Step 4 : Câbler le plugin**

Dans `packages/gameplay/src/GameplayPlugin.ts` :
1. Importer `OccluderStrip` et `OccluderRenderSystem`.
2. Repérer l'enregistrement de `TileMapRenderSystem` (cherche `new TileMapRenderSystem`). Il y a : (a) un `world.defineComponent(...)` pour les composants tilemap, (b) une construction `new TileMapRenderSystem(nebula, sortingLayers)`, (c) un `registerSystem(render, world, tileMapRenderSystem, { stage: "PreRender" })`, (d) un `world.onRemove(TileMap, (e) => tileMapRenderSystem.unmount(e))`.
3. Ajouter les lignes **symétriques** juste après, en réutilisant les mêmes `nebula`, `sortingLayers`, `world`, `render` :

```ts
world.defineComponent(OccluderStrip);

const occluderRenderSystem: OccluderRenderSystem = new OccluderRenderSystem(
  nebula,
  sortingLayers,
);
registerSystem(render, world, occluderRenderSystem, { stage: "PreRender" });
world.onRemove(OccluderStrip, (entity: Entity): void => occluderRenderSystem.unmount(entity));
```

(Si `defineComponent` est chaîné — `world.defineComponent(A).defineComponent(B)` — ajoute `.defineComponent(OccluderStrip)` à la chaîne au lieu d'une ligne séparée.)

- [ ] **Step 5 : Lancer, vérifier le succès**

Run: `pnpm --filter @atlasjs/gameplay build && pnpm --filter @atlasjs/gameplay test occluder-plugin`
Expected: PASS (2 tests).

- [ ] **Step 6 : Vérifier que toute la suite passe + typecheck**

Run: `pnpm --filter @atlasjs/gameplay test && pnpm --filter @atlasjs/gameplay exec tsc --noEmit`
Expected: PASS, aucune erreur de type.

- [ ] **Step 7 : Stager pour review**

```bash
git add packages/gameplay/src/GameplayPlugin.ts packages/gameplay/src/index.ts packages/gameplay/test/occluder-plugin.test.ts
```

---

### Task 5: Ingestion Tiled dans `MapBuilder` + vérif navigateur

**Files:**
- Create: `apps/dino-brawl/src/game/tiled/ingestOccluders.ts`
- Modify: `apps/dino-brawl/src/game/tiled/MapBuilder.ts`

**Interfaces:**
- Consumes: `bakeOccluderStrips`/`OccluderRegion`/`OccluderStripData`/`OccluderStrip` (`@atlasjs/gameplay`), `Transform2D`/`Vec2` (`@atlasjs/gameplay` ou `@atlasjs/math` selon les imports existants de `MapBuilder`), `TileMap`/`TileMapRenderer`/`Grid` (`@atlasjs/gameplay`), `colliderFromRect` (`./mapMath`), `RectObject`/`ResolvedObject` (`./resolved.types`), `TiledDocument` (`./TiledDocument`), `NexusWorld`/`Entity` (`@atlasjs/nexus`).
- Produces: `function ingestOccluders(nexus, grid, doc, occluderLayerEntities, scale, sortingLayer, logger): void`.

> **Prérequis d'authoring (Tiled)** : dans la map `.tmj`, un ou plusieurs **calques de tuiles** nommés avec le préfixe `Occluders` (ex. `Occluders_Walls`) où l'occluder est peint tuile par tuile, et un **calque d'objets** `OccluderRegions` avec un **rectangle** par occluder (props optionnelles `slice: "single" | "perRow"`).

- [ ] **Step 1 : Écrire le helper d'ingestion**

```ts
// apps/dino-brawl/src/game/tiled/ingestOccluders.ts
import { Transform2D, Vec2 } from "@atlasjs/math";
import { OccluderStrip, TileMap, bakeOccluderStrips } from "@atlasjs/gameplay";
import type { OccluderRegion, OccluderStripData } from "@atlasjs/gameplay";
import { colliderFromRect } from "./mapMath";
import type { MapCollider } from "./mapMath";
import type { RectObject, ResolvedObject } from "./resolved.types";
import type { TiledDocument } from "./TiledDocument";
import type { Logger } from "@atlasjs/utils";
import type { Entity, NexusWorld } from "@atlasjs/nexus";

export function isOccluderRegion(obj: ResolvedObject): obj is RectObject {
  return (
    obj.kind === "rect" &&
    (obj.groupPath.includes("OccluderRegions") || obj.properties.occluder === true)
  );
}

export function ingestOccluders(
  nexus: NexusWorld,
  grid: Entity,
  doc: TiledDocument,
  occluderLayerEntities: readonly Entity[],
  scale: number,
  defaultSortingLayer: string,
  logger: Logger,
): void {
  const cellSize: Vec2 = new Vec2(doc.tileWidth, doc.tileHeight);
  const cellGap: Vec2 = new Vec2(0, 0);

  const regions: OccluderRegion[] = [];
  for (const obj of doc.objects) {
    if (!isOccluderRegion(obj)) {
      continue;
    }
    const world: MapCollider = colliderFromRect(obj, scale);
    const slice: "single" | "perRow" = obj.properties.slice === "perRow" ? "perRow" : "single";
    const sortingLayer: string =
      typeof obj.properties.sortingLayer === "string"
        ? obj.properties.sortingLayer
        : defaultSortingLayer;

    regions.push({
      cellBounds: {
        cxMin: Math.floor(obj.x / cellSize.x),
        cyMin: Math.floor(obj.y / cellSize.y),
        cxMax: Math.ceil((obj.x + obj.width) / cellSize.x) - 1,
        cyMax: Math.ceil((obj.y + obj.height) / cellSize.y) - 1,
      },
      slice,
      sortingLayer,
      footYWorld: world.y + world.height,
      rowFootYWorld: (cy: number): number => scale * (cy + 1) * cellSize.y,
    });
  }

  if (regions.length === 0) {
    return;
  }

  for (const layerEntity of occluderLayerEntities) {
    const tileMap: TileMap | undefined = nexus.getComponent(layerEntity, TileMap);
    if (tileMap === undefined) {
      continue;
    }
    for (const region of regions) {
      const strips: OccluderStripData[] = bakeOccluderStrips(region, tileMap, cellSize, cellGap);
      if (strips.length === 0) {
        continue;
      }
      for (const strip of strips) {
        const entity: Entity = nexus.createEntity();
        nexus.addComponent(entity, Transform2D);
        nexus.addComponent(
          entity,
          OccluderStrip,
          strip.footY,
          strip.tiles,
          strip.texture,
          strip.sortingLayer,
        );
        nexus.setParent(entity, grid);
      }
    }
    logger.info(`Occluder layer baked into strips (${regions.length} regions).`);
  }
}
```

- [ ] **Step 2 : Brancher `MapBuilder.build`**

Dans `apps/dino-brawl/src/game/tiled/MapBuilder.ts` :

1. **Importer** `ingestOccluders`, `isOccluderRegion`, `TileMapRenderer` (`@atlasjs/gameplay`).

2. **Capturer les entités d'occluder par calque** dans la boucle des calques de tuiles. Remplacer :

```ts
const tileLayers: Entity[] = [];
for (const layer of doc.tileLayers) {
  MapBuilder.buildTileLayer(nexus, grid, layer, tilesets, options, tileLayers, logger);
}
```

par :

```ts
const tileLayers: Entity[] = [];
const occluderLayerEntities: Entity[] = [];
for (const layer of doc.tileLayers) {
  const layerEntities: Entity[] = [];
  MapBuilder.buildTileLayer(nexus, grid, layer, tilesets, options, layerEntities, logger);
  tileLayers.push(...layerEntities);
  if (layer.name.startsWith("Occluders")) {
    occluderLayerEntities.push(...layerEntities);
  }
}
```

3. **Exclure les rects d'occluder** de la boucle des colliders. Dans le `else if (obj.kind === "rect")`, remplacer :

```ts
} else if (obj.kind === "rect") {
  const rect: RectObject = obj;
  colliders.push(colliderFromRect(rect, options.scale));
}
```

par :

```ts
} else if (obj.kind === "rect") {
  if (!isOccluderRegion(obj)) {
    colliders.push(colliderFromRect(obj, options.scale));
  }
}
```

4. **Ingérer les occluders puis retirer le rendu à plat**, juste avant le `return { grid, ... }` :

```ts
ingestOccluders(nexus, grid, doc, occluderLayerEntities, options.scale, objectLayer, logger);
for (const layerEntity of occluderLayerEntities) {
  nexus.removeComponent(layerEntity, TileMapRenderer);
}
```

- [ ] **Step 3 : Typecheck + rebuild du dist gameplay**

Run: `pnpm --filter @atlasjs/gameplay build && pnpm --filter dino-brawl exec tsc --noEmit`
Expected: aucune erreur. (Vérifier que `isOccluderRegion`/`ingestOccluders` sont bien importés et typés ; que `layer.name` existe sur les calques résolus — sinon utiliser le champ de nom réel.)

- [ ] **Step 4 : Préparer une région d'occluder de test dans Tiled**

Dans la map dino-brawl (`.tmj`) : ajouter un calque de tuiles `Occluders_Walls` avec un mur de plusieurs tuiles de haut, et un calque d'objets `OccluderRegions` avec un rectangle couvrant la **base** du mur (laisser `slice` par défaut = `single`). Sauvegarder.

- [ ] **Step 5 : Vérif navigateur (obligatoire)**

1. Lancer le serveur dev dino-brawl via `preview_start` (config `.claude/launch.json`, créer si absente).
2. **Redémarrer le serveur** plutôt que compter sur le HMR (le HMR sert parfois une scène périmée — cf. mémoire *sandbox browser-verify gotchas*).
3. Stasher la scène pour inspection : ajouter temporairement `window.__scene = nebula.scene` (ou équivalent) et vérifier via `javascript_tool` que des `TileMapNode` d'occluder sont présents avec le bon `sortPrimary` (= `footY`).
4. Déplacer le joueur **au-dessus** de la base du mur → le joueur passe **derrière** ; **en dessous** → **devant**. Faire une capture (`computer screenshot`) des deux états.
5. Vérifier `read_console_messages` / `preview_logs` : aucune erreur.

Expected: le joueur s'intercale correctement devant/derrière le mur ; aucun écran noir (imports `import type` OK) ; pas de double rendu du calque `Occluders_Walls` (le `TileMapRenderer` a été retiré).

- [ ] **Step 6 : Stager pour review**

```bash
git add apps/dino-brawl/src/game/tiled/ingestOccluders.ts apps/dino-brawl/src/game/tiled/MapBuilder.ts
```
(Ajouter aussi le `.tmj` modifié si la région de test doit rester.)

---

## Self-Review

**1. Couverture du spec :**
- §2 modèle (strips par `footY`, sac = `TileMapNode`) → Task 3.
- §3 décisions (Backend 1 entités, `single`/`perRow`, réutilise `TileMapNode`) → Tasks 1-3-5.
- §4-5 authoring + baker Tiled → Tasks 2 + 5.
- §6 `OccluderStrip` → Task 1.
- §7 `OccluderRenderSystem` + statique → Task 3.
- §7.1 batching → propriété émergente (aucun code : `RenderQueue` existant), vérifiée en §12/Task 5.
- §8 tri ySorted → Task 3 (assert `sortPrimary === footY`).
- §9 seam collider → **hors périmètre** (design §9), non planifié : OK.
- §10 coordonnées/échelle → Task 5 (`footY` monde via `colliderFromRect`, instances locales, scale du Grid).
- §11 placements/enregistrements → Task 4.
- §12 tests → Tasks 2/3/4 (unit) + Task 5 (navigateur).
- Décision D multi-tileset → Task 5 (un strip par entité d'occluder-layer, bucketée par tileset via `buildTileLayer`).

**2. Placeholders :** aucun `TODO`/`TBD` ; tout le code est concret. Seuls points « à confirmer en lisant le fichier » : le champ de nom des calques résolus (`layer.name`) en Task 5, et le site exact d'enregistrement dans `GameplayPlugin` en Task 4 — les deux pointent un ancrage précis existant.

**3. Cohérence des types :** `OccluderStrip(footY, tiles, texture, sortingLayer)` identique en Tasks 1/3/4/5 ; `OccluderStripData`/`OccluderRegion` identiques Tasks 2/5 ; `bakeOccluderStrips(region, layer, cellSize, cellGap): OccluderStripData[]` identique Tasks 2/5 ; `OccluderRenderSystem(nebula, sortingLayers)` + `.unmount(entity)` identiques Tasks 3/4.
