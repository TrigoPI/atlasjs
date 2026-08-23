import type { Entity } from "@atlasjs/nexus";

import { CollisionLayers, SortingLayer, SortingOrder } from "../../config";

import {
  SwordHitboxScript,
  SwordScript,
  SwordSortingScript,
  type WeaponAttack,
  type WeaponAttackFactory,
} from "../../scripts";

import {
  Collider2D,
  Color,
  definePrefab,
  RigidBody,
  Sprite,
  SpriteRender,
  Transform2D,
  TrailRenderer,
  type EntityBuilder,
} from "@atlasjs/gameplay";

export type SwordPrefabProps = {
  r: number;
  owner: Entity;
  anchor: Entity;
  angle: number;
  swordSprite: Sprite;
  colliderRotation?: number;
  attack: WeaponAttackFactory;
};

const DEFAULT_COLLIDER_ROTATION: number = Math.PI / 4;

export const createSwordPrefab = () =>
  definePrefab<SwordPrefabProps>({
    name: "sword",
    build: (entity: EntityBuilder, props: SwordPrefabProps): void => {
      entity.add(Transform2D);

      entity.child((e: EntityBuilder): void => {
        const renderer: SpriteRender = e.add(SpriteRender, props.swordSprite);
        renderer.sortingLayer = SortingLayer.Entities;
        renderer.sortingOrder = SortingOrder.SwordFront;
        renderer.sortPointEntity = props.owner;
        renderer.sprite.pivot.set(0, 1);

        const transform: Transform2D = e.add(Transform2D);
        transform.scale.set(1.2, 1.2);

        const body: RigidBody = e.add(RigidBody);
        body.type = "kinematic";

        const collider: Collider2D = e.add(Collider2D, {
          type: "box",
          width: 30,
          height: 60,
        });

        collider.offset.set(20, -20);
        collider.rotation = props.colliderRotation ?? DEFAULT_COLLIDER_ROTATION;
        collider.isSensor = true;
        collider.layer = CollisionLayers.Weapon;
        collider.collidesWith = CollisionLayers.Enemy;

        const attack: WeaponAttack = props.attack(e);
        const hitbox: SwordHitboxScript = e.attach(SwordHitboxScript);

        let trail!: TrailRenderer;

        e.child((tip: EntityBuilder): void => {
          tip.add(Transform2D).position.set(44, -44);

          trail = tip.add(TrailRenderer, {
            time: 0.14,
            minVertexDistance: 3,
            startWidth: 10,
            endWidth: 0,
            startColor: new Color(1, 1, 1, 0.9),
            endColor: new Color(0.6, 0.85, 1, 0),
            emitting: false,
            maxPoints: 48,
            blend: "additive",
            sortingLayer: SortingLayer.Entities,
            sortingOrder: SortingOrder.SwordFront,
          });
        });

        e.attach(SwordScript, {
          playerAnchor: props.anchor,
          radius: props.r,
          angleOffset: props.angle,
          attack,
          hitbox,
          trail,
          knockback: 1000,
        });

        e.attach(SwordSortingScript, {
          anchor: props.anchor,
          sortingFront: SortingOrder.SwordFront,
          sortingBehind: SortingOrder.SwordBehind,
        });
      });
    },
  });
