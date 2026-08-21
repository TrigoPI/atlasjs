import type { Vec2 } from "@atlasjs/math";

import { AimScript } from "../../scripts";

import {
  definePrefab,
  Transform2D,
  type EntityBuilder,
} from "@atlasjs/gameplay";

export type SwordAnchorPrefabProps = {
  anchor: Vec2;
};

export const createSwordAnchorPrefab = () =>
  definePrefab<SwordAnchorPrefabProps>({
    name: "sword_anchor",
    build: (entity: EntityBuilder, props: SwordAnchorPrefabProps): void => {
      const transform: Transform2D = entity.add(Transform2D);
      transform.position.copyFrom(props.anchor);

      entity.attach(AimScript);
    },
  });
