import { Vec2 } from "@atlasjs/math";
import type { AudioClip } from "@atlasjs/audio";

import { SortingOrder } from "../config";
import { ARENA_BOUNDS } from "../arena";
import { MoveIntent } from "../sim";
import type { PlayerControlsType } from "../controls";

import {
  PlayerCollisionScript,
  PlayerEyesScript,
  PlayerFallScript,
  PlayerMovementScript,
  PlayerSoundScript,
} from "../script/player";

import {
  AfterimageRenderer,
  Collider2D,
  Color,
  ParticleEmitter,
  definePrefab,
  PlayerInput,
  RigidBody,
  Sprite,
  SpriteRenderer,
  Tag,
  Transform2D,
  type ActionMapDescriptor,
  type EntityBuilder,
} from "@atlasjs/gameplay";

export type PlayerPrefabProps = {
  position: Vec2;
  color: Color;
  playerSprite: Sprite;
  playerEyesSprite: Sprite;
  shadowSprite: Sprite;
  dustSprite: Sprite;
  bumpAudio: AudioClip;
  fallAudio: AudioClip;
  controls: ActionMapDescriptor<PlayerControlsType>;
};

const SCALE = 3.5;
const RADIUS = 8;
const COLLIDER_RADIUS = SCALE * RADIUS;
const FALL_DURATION = 0.35;

// prettier-ignore
export const createPlayerPrefab = () =>
  definePrefab<PlayerPrefabProps>({
    name: "player",
    build: (entity: EntityBuilder, props: PlayerPrefabProps): void => {
      const transform: Transform2D = entity.add(Transform2D);
      transform.position.copyFrom(props.position);
      transform.scale.set(SCALE, SCALE);

      const renderer: SpriteRenderer = entity.add(SpriteRenderer, props.playerSprite);
      renderer.sortingOrder = SortingOrder.Player;
      renderer.color = props.color;

      const body: RigidBody = entity.add(RigidBody);
      body.type = "dynamic";
      body.lockRotation = true;


      const collider: Collider2D = entity.add(Collider2D, { type: "circle", radius: COLLIDER_RADIUS });
      collider.restitution = 1;
      collider.friction = 0.05;

      entity.add(MoveIntent);
      entity.add(PlayerInput, props.controls);
      entity.add(Tag, "Player");

      const playerEyes: EntityBuilder = entity.child((e: EntityBuilder) => {
        const t: Transform2D = e.add(Transform2D);
        t.position.set(0, 0);

        const r: SpriteRenderer = e.add(SpriteRenderer, props.playerEyesSprite);
        r.sortingOrder = SortingOrder.PlayerEyes;
      });

      const dust: EntityBuilder = entity.child((e: EntityBuilder) => {
        const t: Transform2D = e.add(Transform2D);
        t.position.set(0, 0);

        e.add(ParticleEmitter, {
          frames: [props.dustSprite],
          blend: "alpha",
          sortingOrder: SortingOrder.Dust,
          playOnAwake: false,
          config: {
            rate: 0,
            looping: false,
            duration: 0.5,
            maxParticles: 10,
            simulationSpace: "world",
            shape: { kind: "circle", radius: 10 },
            startLifetime: { min: 0.35, max: 0.6 },
            startSpeed: { min: 50, max: 100 },
            startSize: { min: 14, max: 26 },
            drag: 3.5,
            sizeOverLifetime: { from: 1, to: 0.2, easing: "outCubic" },
            colorOverLifetime: {
              from: props.color.clone().setAlpha(1),
              to: props.color.clone().setAlpha(0),
            },
          },
        });
      });

      entity.child((e: EntityBuilder) => {
        const t: Transform2D = e.add(Transform2D);
        t.position.set(0, 5);
        t.scale.set(1.15, 1);

        const r: SpriteRenderer = e.add(SpriteRenderer, props.shadowSprite);
        r.sortingOrder = SortingOrder.Shadow;
        r.color = Color.Black().setAlpha(0.5);
      });

      entity.add(AfterimageRenderer, {
        interval: 0.04,
        time: 0.12,
        startColor: props.color.clone().setAlpha(0.5),
        endColor: props.color.clone().setAlpha(0),
        sortingOrder: SortingOrder.Trail,
        maxImages: 15,
      });

      entity.attach(PlayerSoundScript, {
        bumpAudio: props.bumpAudio,
        maxImpactSpeed: 700,
        minVolume: 0.3,
        maxVolume: 0.5,
        minPitch: 0.8,
        maxPitch: 1.25,
        pitchJitter: 0.05,
      });

      entity.attach(PlayerCollisionScript, {
        dust: dust.entity,
        dustBurst: 22,
        squishScale: 0.85,
        squishDuration: 0.5,
        squishDamping: 2,
        squishFrequency: 2,
      });

      entity.attach(PlayerEyesScript, {
        playerEyes: playerEyes.entity,
        radius: 2,
        rotationSpeed: 5,
      });

      entity.attach(PlayerFallScript, {
        bounds: ARENA_BOUNDS,
        radius: COLLIDER_RADIUS,
        fallDuration: FALL_DURATION,
        respawnPosition: props.position.clone(),
        fallAudio: props.fallAudio,
      });

      entity.attach(PlayerMovementScript, {
        maxSpeed: 300,
        acceleration: 600,
        deceleration: 300,
        dashSpeed: 700,
        dashDuration: 0.18,
        dashCooldown: 0.6,
        overspeedDeceleration: 5000,
      });
    },
  });
