import { Vec2, Vec4 } from "@atlasjs/math";
import { TileMapNode } from "@atlasjs/nebula";
import type { Bound, Mat3 } from "@atlasjs/math";
import type { NebulaRenderer, TileInstance } from "@atlasjs/nebula";

import type { Tile } from "../assets/Tile";
import { Grid } from "../components/Grid";
import { TileMap } from "../components/TileMap";
import { TileMapRenderer } from "../components/TileMapRenderer";
import { WorldTransform2D } from "../components/WorldTransform2D";
import { cellOrigin, visibleCellRange, worldBoundToLocalBound } from "./tilemap-geometry";
import type { CellRange } from "./tilemap-geometry";

import type {
  Entity,
  NexusSystem,
  NexusSystemContext,
  NexusWorld,
} from "@atlasjs/nexus";

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
          this.rebuildInstances(node, grid, tileMap, worldTransform);
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
    node.zIndex = renderer.sortingOrder;
    node.visible = renderer.visible;
    node.tint.set(
      renderer.color.r,
      renderer.color.g,
      renderer.color.b,
      renderer.color.a,
    );
  }

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
        const rect: Bound = tile.sprite.rect;

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
}
