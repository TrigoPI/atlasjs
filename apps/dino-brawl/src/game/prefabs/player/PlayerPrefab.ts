import type { Vec2 } from "@atlasjs/math";
import type { SpriteAnimation } from "@atlasjs/nebula";

import {
  PlayerAnimationScript,
  PlayerMovementScript,
  RunningAudioPlayerScript,
  RunningParticleSpawnerScript,
} from "../../scripts";
import { CollisionLayers, SortingLayer, SortingOrder } from "../../config";
import { dinoControls } from "../../controls";

import type { RunningParticlePrefabProps } from "../fx/RunningParticlePrefab";

import {
  Animator,
  CharacterController2D,
  Collider2D,
  definePrefab,
  PlayerInput,
  RigidBody,
  Sprite,
  SpriteRenderer,
  Transform2D,
  type EntityBuilder,
  type Prefab,
} from "@atlasjs/gameplay";

export type PlayerPrefabOptions = {
  runningParticlePrefab: Prefab<RunningParticlePrefabProps>;
  runningAudioPrefab: Prefab;
};

export type PlayerPrefabProps = {
  position: Vec2;
  sprite: Sprite;
  clips: Record<string, SpriteAnimation>;
};

// prettier-ignore
export const createPlayerPrefab = (options: PlayerPrefabOptions) =>
  definePrefab<PlayerPrefabProps>({
    name: "player",
    build: (entity: EntityBuilder, props: PlayerPrefabProps): void => {
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
      collider.layer = CollisionLayers.Player;
      collider.collidesWith = CollisionLayers.World;
  
      entity.add(Animator, props.clips, "idle");
      entity.add(CharacterController2D);
      entity.add(PlayerInput, dinoControls);

      entity.attach(PlayerAnimationScript);
      
      entity.attach(PlayerMovementScript, {
        walkingSpeed: 200,
        runningSpeed: 205,
      });

      entity.attach(RunningParticleSpawnerScript, {
        runningParticlePrefab: options.runningParticlePrefab
      });

      entity.attach(RunningAudioPlayerScript, {
        audioPrefab: options.runningAudioPrefab
      });
    },
  });
