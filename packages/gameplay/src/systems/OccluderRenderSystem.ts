import { Vec2 } from "@atlasjs/math";
import { TileMapNode } from "@atlasjs/nebula";
import type { NebulaRenderer } from "@atlasjs/nebula";
import { applySortFields } from "../rendering/applySortFields";
import { syncNodeTransform } from "../rendering/syncNodeTransform";
import type { SortingLayers } from "../rendering";
import { OccluderStrip } from "../components/OccluderStrip";
import { WorldTransform2D } from "../components/WorldTransform2D";
import type { Entity, NexusSystem, NexusSystemContext } from "@atlasjs/nexus";

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

  public update({ world }: NexusSystemContext): void {
    world
      .query(WorldTransform2D, OccluderStrip)
      .each(
        (
          entity: Entity,
          worldTransform: WorldTransform2D,
          strip: OccluderStrip,
        ) => {
          const node: TileMapNode = this.resolveNode(entity, strip);

          syncNodeTransform(
            node,
            worldTransform,
            this.positionScratch,
            this.scaleScratch,
            false,
            false,
          );

          applySortFields(
            node,
            this.sortingLayers,
            strip.sortingLayer,
            0,
            strip.footY,
          );
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
