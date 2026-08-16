import { Vec2 } from "@atlasjs/math";
import { SortingLayer, SortingOrder } from "../config";

import {
  definePrefab,
  Sprite,
  SpriteRenderer,
  Transform2D,
  type EntityBuilder,
} from "@atlasjs/gameplay";

export type ShadowPrefabProps = {
  sprite: Sprite;
  scale: Vec2;
  offset: Vec2;
};

export const createShadowPrefab = () =>
  definePrefab<ShadowPrefabProps>({
    name: "shadow",
    build: (entity: EntityBuilder, props: ShadowPrefabProps): void => {
      const transform: Transform2D = entity.add(Transform2D);
      transform.scale.copyFrom(props.scale);
      transform.position.copyFrom(props.offset);

      const renderer: SpriteRenderer = entity.add(SpriteRenderer, props.sprite);
      renderer.sortingLayer = SortingLayer.Entities;
      renderer.sortingOrder = SortingOrder.Shadow;
      renderer.color.set(1, 1, 1, 0.4);
    },
  });
