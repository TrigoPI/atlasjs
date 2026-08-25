import { Vec2, Vec4 } from "@atlasjs/math";
import { TileMapNode } from "@atlasjs/nebula";
import type { Bound, Mat3 } from "@atlasjs/math";
import type { NebulaRenderer, TileInstance } from "@atlasjs/nebula";

import type { Tile } from "@atlasjs/nebula";
import type { CellOrigin, CellRange } from "./utils";
import { applySortFields } from "../rendering/applySortFields";
import type { SortingLayers } from "../rendering";

import { Grid } from "../components/Grid";
import { TileMap } from "../components/TileMap";
import { TileMapRenderer } from "../components/TileMapRenderer";
import { WorldTransform2D } from "../components/WorldTransform2D";

import {
  cellOrigin,
  visibleCellRange,
  worldBoundToLocalBound,
} from "./utils/tilemap-geometry";

import type {
  Entity,
  NexusSystem,
  NexusSystemContext,
  NexusWorld,
} from "@atlasjs/nexus";

type RebuildKey = {
  revision: number;
  cxMin: number;
  cyMin: number;
  cxMax: number;
  cyMax: number;
};

export class TileMapRenderSystem implements NexusSystem {
  private readonly nebula: NebulaRenderer;
  private readonly nodes: Map<Entity, TileMapNode>;
  private readonly rebuildKeys: Map<Entity, RebuildKey>;
  private readonly positionScratch: Vec2;
  private readonly scaleScratch: Vec2;
  private readonly sortingLayers: SortingLayers;

  public constructor(nebula: NebulaRenderer, sortingLayers: SortingLayers) {
    this.nebula = nebula;
    this.sortingLayers = sortingLayers;
    this.nodes = new Map<Entity, TileMapNode>();
    this.rebuildKeys = new Map<Entity, RebuildKey>();
    this.positionScratch = new Vec2();
    this.scaleScratch = new Vec2();
  }

  // prettier-ignore
  public update({ world }: NexusSystemContext): void {
    world
      .query(WorldTransform2D, TileMap, TileMapRenderer)
      .each((entity: Entity, worldTransform: WorldTransform2D, tileMap: TileMap, renderer: TileMapRenderer) => {
          const grid: Grid | undefined = this.resolveGrid(world, entity);
          if (grid === undefined) {
            return;
          }

          const node: TileMapNode = this.resolveNode(entity);
          this.syncNode(node, worldTransform, renderer, tileMap);
          this.rebuildInstances(entity, node, grid, tileMap, worldTransform);
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
    this.rebuildKeys.delete(entity);
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

    applySortFields(
      node,
      this.sortingLayers,
      renderer.sortingLayer,
      renderer.sortingOrder,
      position.y,
    );

    node.visible = renderer.visible;
    node.tint.set(
      renderer.color.r,
      renderer.color.g,
      renderer.color.b,
      renderer.color.a,
    );
  }

  private rebuildInstances(
    entity: Entity,
    node: TileMapNode,
    grid: Grid,
    tileMap: TileMap,
    worldTransform: WorldTransform2D,
  ): void {
    const viewport: Bound = this.nebula.getCameraViewport();
    const invWorld: Mat3 = worldTransform.matrix.clone().invert();
    const localViewport: Bound = worldBoundToLocalBound(invWorld, viewport);
    const range: CellRange = visibleCellRange(
      grid.cellSize,
      grid.cellGap,
      localViewport,
    );

    const revision: number = tileMap.revision;
    const previous: RebuildKey | undefined = this.rebuildKeys.get(entity);
    if (
      previous !== undefined &&
      previous.revision === revision &&
      previous.cxMin === range.cxMin &&
      previous.cyMin === range.cyMin &&
      previous.cxMax === range.cxMax &&
      previous.cyMax === range.cyMax
    ) {
      return;
    }

    const instances: TileInstance[] = node.instances;
    const textureWidth: number = tileMap.tileset.texture.width;
    const textureHeight: number = tileMap.tileset.texture.height;

    let count: number = 0;

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

        // prettier-ignore
        const origin: CellOrigin = cellOrigin(grid.cellSize, grid.cellGap, cx, cy);
        const rect: Bound = tile.sprite.rect;

        let instance: TileInstance | undefined = instances[count];
        if (instance === undefined) {
          instance = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            uvRect: new Vec4(),
          };
          instances.push(instance);
        }

        instance.x = origin.x;
        instance.y = origin.y;
        instance.width = rect.width;
        instance.height = rect.height;
        instance.uvRect.set(
          rect.x / textureWidth,
          rect.y / textureHeight,
          rect.width / textureWidth,
          rect.height / textureHeight,
        );

        count++;
      }
    }

    instances.length = count;

    this.rebuildKeys.set(entity, {
      revision,
      cxMin: range.cxMin,
      cyMin: range.cyMin,
      cxMax: range.cxMax,
      cyMax: range.cyMax,
    });
  }
}
