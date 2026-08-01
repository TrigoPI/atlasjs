import { Vec2 } from "@atlasjs/math";
import type { SceneContext } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";
import { type AssetManager, ASSET_MANAGER } from "@atlasjs/assets";

import {
  type Sprite,
  Collider2D,
  SpriteAsset,
  SpriteRenderer,
  Transform2D,
} from "@atlasjs/gameplay";

import { ResourcesPath } from "../ResourcesPath";
import { SortingLayer, CollisionLayers } from "../config";

export async function spawnProps(
  ctx: SceneContext,
  spawnPosition: Vec2,
): Promise<void> {
  // const nexus: NexusWorld = ctx.services.get(NEXUS);
  // const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
  // // prettier-ignore
  // const treeAsset: SpriteAsset = SpriteAsset.fromPath(ResourcesPath.Tilesets.Player.Tree1, { pivot: new Vec2(0.5, 0.95) });
  // const treeSprite: Sprite = await assets.load<Sprite>(treeAsset);
  // const treePositions: Vec2[] = [
  //   new Vec2(spawnPosition.x - 110, spawnPosition.y - 48),
  //   new Vec2(spawnPosition.x + 110, spawnPosition.y + 48),
  // ];
  // for (const treePosition of treePositions) {
  //   const tree: Entity = nexus.createEntity();
  //   const treeTransform: Transform2D = nexus.addComponent(tree, Transform2D);
  //   treeTransform.position = treePosition;
  //   nexus.addComponent(tree, SpriteRenderer, treeSprite).sortingLayer =
  //     SortingLayer.Entities;
  //   const treeCollider: Collider2D = nexus.addComponent(tree, Collider2D, {
  //     type: "box",
  //     width: 24,
  //     height: 48,
  //   });
  //   treeCollider.layer = CollisionLayers.Occluder;
  //   treeCollider.collidesWith = CollisionLayers.Player;
  // }
}
