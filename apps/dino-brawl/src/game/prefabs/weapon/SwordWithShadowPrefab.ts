import { Vec2 } from "@atlasjs/math";
import type { AudioClip } from "@atlasjs/audio";
import type { Entity } from "@atlasjs/nexus";

import { CollisionLayers, SortingLayer, SortingOrder } from "../../config";

import {
  SwordAnchorScript,
  SwordHitboxScript,
  SwordScript,
  SwordShadowScript,
  SwordSortingScript,
  type WeaponAttack,
} from "../../scripts";

import {
  Collider2D,
  Color,
  definePrefab,
  RigidBody,
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
  swordSprite: Sprite;
  shadowSprite: Sprite;
  attack: (entity: EntityBuilder) => WeaponAttack;
  hitClip?: AudioClip;
  debug?: Sprite;
};

export const createSwordWithShadowPrefab = () =>
  definePrefab<SwordWithShadowPrefabProps>({
    name: "sword_with_shadow",
    build: (entity: EntityBuilder, props: SwordWithShadowPrefabProps): void => {
      entity.add(Transform2D);

      entity.child((e: EntityBuilder): void => {
        const transform: Transform2D = e.add(Transform2D);
        transform.scale.set(0.2, 0.2);

        if (props.debug) {
          const renderer: SpriteRender = e.add(SpriteRender, props.debug);
          renderer.sortingLayer = SortingLayer.Overhead;
        }

        e.attach(SwordAnchorScript, {
          anchor: props.anchor,
          angle: props.angle,
          r: props.r,
        });
      });

      const sword: EntityBuilder = entity.child((e: EntityBuilder): void => {
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
          width: 40,
          height: 40,
        });
        collider.offset.set(0, 0);
        collider.isSensor = true;
        collider.layer = CollisionLayers.Weapon;
        collider.collidesWith = CollisionLayers.Enemy;

        const attack: WeaponAttack = props.attack(e);

        const hitbox: SwordHitboxScript = e.attach(SwordHitboxScript);

        e.attach(SwordScript, {
          playerAnchor: props.anchor,
          radius: props.r,
          angleOffset: props.angle,
          attack,
          hitbox,
          hitClip: props.hitClip,
        });

        e.attach(SwordSortingScript, {
          anchor: props.anchor,
          sortingFront: SortingOrder.SwordFront,
          sortingBehind: SortingOrder.SwordBehind,
        });
      });

      // entity.child((e: EntityBuilder): void => {
      //   const renderer: SpriteRender = e.add(SpriteRender, props.shadowSprite);
      //   renderer.sortingLayer = SortingLayer.Entities;
      //   renderer.sortingOrder = SortingOrder.Shadow;
      //   renderer.sortPointEntity = props.owner;
      //   renderer.color = new Color(0, 0, 0, 0.4);

      //   e.add(Transform2D);

      //   e.attach(SwordShadowScript, {
      //     anchor: swordAnchor.entity,
      //     sword: sword.entity,
      //     shadowOffset: new Vec2(16, 20),
      //     scale: new Vec2(0.5, 0.5),
      //   });
      // });
    },
  });
