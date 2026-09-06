import {
  Color,
  definePrefab,
  SpriteRenderer,
  type EntityBuilder,
  type Sprite,
} from "@atlasjs/gameplay";

import { ARENA_BOUNDS } from "../../sim/arena";
import { buildArenaSim } from "../../sim/prefabs";

import { SortingOrder } from "../config";
import { ArenaBoundsGizmoScript } from "../script/arena";

export type ArenaPrefabProps = {
  sprite: Sprite;
  showBounds: boolean;
};

const BOUNDS_GIZMO_THICKNESS: number = 3;

export const createArenaPrefab = () =>
  definePrefab<ArenaPrefabProps>({
    name: "arena",
    build: (entity: EntityBuilder, props: ArenaPrefabProps): void => {
      buildArenaSim(entity);

      const renderer: SpriteRenderer = entity.add(SpriteRenderer, props.sprite);
      renderer.sortingOrder = SortingOrder.Ground;

      if (props.showBounds) {
        entity.attach(ArenaBoundsGizmoScript, {
          bounds: ARENA_BOUNDS,
          thickness: BOUNDS_GIZMO_THICKNESS,
          color: new Color(1, 0, 1, 1),
        });
      }
    },
  });
