import { Vec2 } from "@atlasjs/math";
import type { SpriteAnimation } from "@atlasjs/nebula";
import type { Entity } from "@atlasjs/nexus";

import { SortingLayer, SortingOrder } from "../../config";
import { ImpactScript } from "../../scripts";

import {
  Animator,
  definePrefab,
  Sprite,
  SpriteRenderer,
  Transform2D,
  type EntityBuilder,
} from "@atlasjs/gameplay";

export type ImpactPrefabOptions = {
  sprite: Sprite;
  clips: () => Record<string, SpriteAnimation>;
  scale?: number;
};

export type ImpactPrefabProps = {
  position: Vec2;
  rotation: number;
  owner: Entity;
};

export const createImpactPrefab = (opt: ImpactPrefabOptions) =>
  definePrefab<ImpactPrefabProps>({
    name: "impact",
    build: (entity: EntityBuilder, props: ImpactPrefabProps): void => {
      entity.add(Animator, opt.clips(), "default");

      const renderer: SpriteRenderer = entity.add(SpriteRenderer, opt.sprite);
      renderer.sortingLayer = SortingLayer.Entities;
      renderer.sortingOrder = SortingOrder.Impact;
      renderer.sortPointEntity = props.owner;

      const transform: Transform2D = entity.add(Transform2D);
      transform.position.copyFrom(props.position).sub(new Vec2(0, 0));
      transform.rotation = props.rotation;

      entity.attach(ImpactScript, { scale: opt.scale });
    },
  });
