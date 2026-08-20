import type { Vec2 } from "@atlasjs/math";
import type { SpriteAnimation } from "@atlasjs/nebula";

import { CollisionLayers, SortingLayer, SortingOrder } from "../../config";

import { HurtboxScript } from "../../scripts";

import {
  Animator,
  Collider2D,
  definePrefab,
  RigidBody,
  Sprite,
  SpriteRenderer,
  Transform2D,
  type EntityBuilder,
} from "@atlasjs/gameplay";

export type EnemyPrefabProps = {
  position: Vec2;
  sprite: Sprite;
  clips: Record<string, SpriteAnimation>;
};

// prettier-ignore
export const createEnemyPrefab = () =>
  definePrefab<EnemyPrefabProps>({
    name: "enemy",
    build: (entity: EntityBuilder, props: EnemyPrefabProps): void => {
      const transform: Transform2D = entity.add(Transform2D);
      transform.position.copyFrom(props.position);
      transform.scale.set(3, 3);

      const renderer: SpriteRenderer = entity.add(SpriteRenderer, props.sprite);
      renderer.sortingLayer = SortingLayer.Entities;
      renderer.sortingOrder = SortingOrder.Player;

      const body: RigidBody = entity.add(RigidBody);
      body.type = "kinematic";

      const collider: Collider2D = entity.add(Collider2D, { type: "box", width: 32, height: 16 });
      collider.offset.set(0, -15);
      collider.layer = CollisionLayers.Enemy;
      collider.collidesWith = CollisionLayers.World;

      entity.add(Animator, props.clips, "idle");

      entity.child((e: EntityBuilder): void => {
        e.add(Transform2D);

        const hitboxBody: RigidBody = e.add(RigidBody);
        hitboxBody.type = "kinematic";

        const hitboxCollider: Collider2D = e.add(Collider2D, { 
          type: "box", 
          width: 32, 
          height: 64 
        });

        hitboxCollider.layer = CollisionLayers.Enemy;
        hitboxCollider.collidesWith = CollisionLayers.Weapon;
        hitboxCollider.isSensor = true;
        hitboxCollider.offset.set(0, -28);

        e.attach(HurtboxScript);
      });
    },
  });
