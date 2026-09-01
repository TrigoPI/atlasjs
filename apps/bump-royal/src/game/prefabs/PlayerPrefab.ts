import { Vec2 } from "@atlasjs/math";

import { playerControls } from "../controls";
import { PlayerMovementScript } from "../script/player";

import {
  Collider2D,
  Color,
  definePrefab,
  PlayerInput,
  RigidBody,
  Sprite,
  SpriteRenderer,
  Transform2D,
  type EntityBuilder,
} from "@atlasjs/gameplay";

export type PlayerPrefabProps = {
  sprite: Sprite;
  color: Color;
  position: Vec2;
};

export const createPlayerPrefab = () =>
  definePrefab<PlayerPrefabProps>({
    name: "player",
    build: (entity: EntityBuilder, props: PlayerPrefabProps): void => {
      const transform: Transform2D = entity.add(Transform2D);
      transform.position.copyFrom(props.position);
      transform.scale.set(1.5, 1.5);

      const renderer: SpriteRenderer = entity.add(SpriteRenderer, props.sprite);
      renderer.color = props.color;

      const body: RigidBody = entity.add(RigidBody);
      body.type = "dynamic";
      body.lockRotation = true;

      entity.add(Collider2D, { type: "circle", radius: 16 });
      entity.add(PlayerInput, playerControls);

      entity.attach(PlayerMovementScript, {
        maxSpeed: 300,
        acceleration: 600,
        deceleration: 300,
      });
    },
  });
