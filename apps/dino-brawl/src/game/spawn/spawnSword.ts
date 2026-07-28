import type { SceneContext } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";
import { type AssetManager, ASSET_MANAGER } from "@atlasjs/assets";

import {
  type ScriptManager,
  type Sprite,
  SCRIPT_MANAGER,
  SpriteAsset,
  SpriteRenderer,
  Transform2D,
} from "@atlasjs/gameplay";

import { ResourcesPath } from "../ResourcesPath";
import { SortingLayer, SortingOrder } from "../config";
import { SwordScript } from "../scripts";

export async function spawnSword(ctx: SceneContext, owner: Entity): Promise<void> {
  const nexus: NexusWorld = ctx.services.get(NEXUS);
  const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
  const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);

  const swordSpriteAsset: SpriteAsset = SpriteAsset.fromPath(ResourcesPath.Sprites.Swords.Default);
  const swordSprite: Sprite = await assets.load<Sprite>(swordSpriteAsset);

  const sword: Entity = nexus.createEntity();
  const swordTransform: Transform2D = nexus.addComponent(sword, Transform2D);
  const swordRender: SpriteRenderer = nexus.addComponent(sword, SpriteRenderer, swordSprite);
  swordRender.sortingLayer = SortingLayer.Entities;
  swordRender.sortingOrder = SortingOrder.Sword;
  swordTransform.scale.set(1.7, 1.7);

  scriptManager.attach(sword, SwordScript, {
    owner: owner,
    maxPower: 500,
    orbitRadius: 45,
    throwDuration: 1,
    rotationSpeed: { max: 10 * Math.PI, min: Math.PI / 2 },
    orbitSpeed: { max: 6 * Math.PI, min: Math.PI },
  });
}
