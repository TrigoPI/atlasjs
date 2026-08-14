import type { Entity } from "@atlasjs/nexus";

import { SwordScript } from "../scripts";
import { SortingLayer, SortingOrder } from "../config";

import {
  type EntityBuilder,
  definePrefab,
  Sprite,
  SpriteRender,
  Transform2D,
} from "@atlasjs/gameplay";

export type SwordPrefabProps = {
  owner: Entity;
  sprite: Sprite;
};

export const createSwordPrefab = () =>
  definePrefab<SwordPrefabProps>({
    name: "sword_prefab",
    build: (entity: EntityBuilder, props: SwordPrefabProps): void => {
      const renderer: SpriteRender = entity.add(SpriteRender, props.sprite);
      renderer.sortingLayer = SortingLayer.Entities;
      renderer.sortingOrder = SortingOrder.Sword;
      renderer.sortPointEntity = props.owner;

      entity.add(Transform2D);
      entity.attach(SwordScript, {
        owner: props.owner,
      });
    },
  });
