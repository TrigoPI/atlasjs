import { SortingOrder } from "../config";

import {
  definePrefab,
  Sprite,
  SpriteRenderer,
  Transform2D,
  type EntityBuilder,
} from "@atlasjs/gameplay";

export type ArenaPrefabProps = {
  sprite: Sprite;
};

export const createArenaPrefab = () =>
  definePrefab<ArenaPrefabProps>({
    name: "arena",
    build: (entity: EntityBuilder, props: ArenaPrefabProps): void => {
      const transform: Transform2D = entity.add(Transform2D);
      transform.position.set(0, 0);
      transform.scale.set(3, 3);

      const renderer: SpriteRenderer = entity.add(SpriteRenderer, props.sprite);
      renderer.sortingOrder = SortingOrder.Ground;
    },
  });
