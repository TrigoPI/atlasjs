import type { AudioClip } from "@atlasjs/audio";

import {
  AfterimageRenderer,
  Color,
  ParticleEmitter,
  SpriteRenderer,
  Transform2D,
  type EntityBuilder,
  type Sprite,
} from "@atlasjs/gameplay";

import { FALL_DURATION } from "../../sim/prefabs/buildPlayerSim";
import { SortingOrder } from "../config";

import {
  PlayerCollisionScript,
  PlayerEyesScript,
  PlayerFallViewScript,
  PlayerSoundScript,
} from "../script/player";

export type PlayerViewProps = {
  color: Color;
  playerSprite: Sprite;
  playerEyesSprite: Sprite;
  shadowSprite: Sprite;
  dustSprite: Sprite;
  bumpAudio: AudioClip;
  fallAudio: AudioClip;
};

/* Asymmetry worth stating: this builder adds no Transform2D to the root, only to the children
   it creates. The local PlayerPrefab gets the root transform from buildPlayerSim; a future
   online-client prefab, which has no rigidbody and therefore no buildPlayerSim, must add its
   own Transform2D before calling this. */
// prettier-ignore
export function buildPlayerView(
  entity: EntityBuilder,
  props: PlayerViewProps,
): void {
  const renderer: SpriteRenderer = entity.add(SpriteRenderer, props.playerSprite);
  renderer.sortingOrder = SortingOrder.Player;
  renderer.color = props.color;

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

  entity.attach(PlayerFallViewScript, {
    fallDuration: FALL_DURATION,
    fallAudio: props.fallAudio,
  });
}
