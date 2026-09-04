import { SortingOrder } from "../config";
import { ARENA_BOUNDS, ARENA_SCALE } from "../arena";
import { ArenaBoundsGizmoScript } from "../script/arena";

import {
  Color,
  definePrefab,
  Sprite,
  SpriteRenderer,
  Tag,
  Transform2D,
  type EntityBuilder,
} from "@atlasjs/gameplay";

export type ArenaPrefabProps = {
  sprite: Sprite;
  showBounds: boolean;
};

const BOUNDS_GIZMO_THICKNESS = 3;

export const createArenaPrefab = () =>
  definePrefab<ArenaPrefabProps>({
    name: "arena",
    build: (entity: EntityBuilder, props: ArenaPrefabProps): void => {
      const transform: Transform2D = entity.add(Transform2D);
      transform.position.set(0, 0);
      transform.scale.set(ARENA_SCALE, ARENA_SCALE);

      const renderer: SpriteRenderer = entity.add(SpriteRenderer, props.sprite);
      renderer.sortingOrder = SortingOrder.Ground;

      entity.add(Tag, "Arena");

      if (props.showBounds) {
        entity.attach(ArenaBoundsGizmoScript, {
          bounds: ARENA_BOUNDS,
          thickness: BOUNDS_GIZMO_THICKNESS,
          color: new Color(1, 0, 1, 1),
        });
      }
    },
  });
