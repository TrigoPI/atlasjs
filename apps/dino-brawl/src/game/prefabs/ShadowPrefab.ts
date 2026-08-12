import { SortingLayer, SortingOrder } from "../config";

import {
  Color,
  definePrefab,
  Sprite,
  SpriteRenderer,
  Transform2D,
  type EntityBuilder,
} from "@atlasjs/gameplay";

export type ShadowPrefabProps = {
  sprite: Sprite;
};

export const createShadowPrefab = () =>
  definePrefab<ShadowPrefabProps>({
    name: "shadow",
    build: (entity: EntityBuilder, props: ShadowPrefabProps): void => {
      const transform: Transform2D = entity.add(Transform2D);
      transform.scale.set(0.7, 0.6);
      transform.position.set(-0.5, -3);

      const renderer: SpriteRenderer = entity.add(SpriteRenderer, props.sprite);
      renderer.sortingLayer = SortingLayer.Entities;
      renderer.sortingOrder = SortingOrder.Shadow;
      renderer.color = new Color(1, 1, 1, 0.4);
    },
  });
