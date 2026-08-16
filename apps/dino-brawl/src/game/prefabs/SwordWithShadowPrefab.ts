import { Vec2 } from "@atlasjs/math";
import type { Entity } from "@atlasjs/nexus";

import { SwordScript, SwordShadowScript } from "../scripts";
import { SortingLayer, SortingOrder } from "../config";

import {
  Color,
  definePrefab,
  Sprite,
  SpriteRender,
  Transform2D,
  type EntityBuilder,
} from "@atlasjs/gameplay";

export type SwordWithShadowPrefabProps = {
  owner: Entity;
  anchor: Entity;
  r: number;
  angle: number;
  angularSpeed: number;
  swordSprite: Sprite;
  shadowSprite: Sprite;
  shadowOffset?: Vec2;
  shadowScale?: Vec2;
};

export const createSwordWithShadowPrefab = () =>
  definePrefab<SwordWithShadowPrefabProps>({
    name: "sword_with_shadow",
    build: (entity: EntityBuilder, props: SwordWithShadowPrefabProps): void => {
      entity.add(Transform2D);

      const orbit: {
        anchor: Entity;
        r: number;
        angle: number;
        angularSpeed: number;
      } = {
        anchor: props.anchor,
        r: props.r,
        angle: props.angle,
        angularSpeed: props.angularSpeed,
      };

      const sword: EntityBuilder = entity.child((e: EntityBuilder): void => {
        const renderer: SpriteRender = e.add(SpriteRender, props.swordSprite);
        renderer.sortingLayer = SortingLayer.Entities;
        renderer.sortingOrder = SortingOrder.Sword;
        renderer.sortPointEntity = props.owner;
        renderer.sprite.pivot.set(0, 0);

        const transform: Transform2D = e.add(Transform2D);
        transform.scale.set(1.5, 1.5);

        e.attach(SwordScript, orbit);
      });

      entity.child((e: EntityBuilder): void => {
        const renderer: SpriteRender = e.add(SpriteRender, props.shadowSprite);
        renderer.sortingLayer = SortingLayer.Entities;
        renderer.sortingOrder = SortingOrder.Shadow;
        renderer.color = new Color(0, 0, 0, 0.3);

        e.add(Transform2D);

        e.attach(SwordShadowScript, {
          ...orbit,
          sword: sword.entity,
          shadowOffset: props.shadowOffset ?? new Vec2(-16, -70),
          scale: props.shadowScale ?? new Vec2(0.5, 0.5),
        });
      });
    },
  });
