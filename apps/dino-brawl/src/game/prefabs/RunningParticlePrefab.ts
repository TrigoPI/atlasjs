import type { Vec2 } from "@atlasjs/math";
import type { AudioClip } from "@atlasjs/audio";
import type { SpriteAnimation } from "@atlasjs/nebula";

import { SortingLayer } from "../config";
import { RunningParticleScript } from "../scripts";

import {
  Animator,
  AudioSource,
  definePrefab,
  Sprite,
  SpriteRenderer,
  Transform2D,
  type EntityBuilder,
} from "@atlasjs/gameplay";

export type RunningParticlePrefabOptions = {
  sprite: Sprite;
  sound: AudioClip;
  clips: () => Record<string, SpriteAnimation>;
};

export type RunningParticlePrefabProps = {
  position: Vec2;
};

export const createRunningParticlePrefab = (
  opt: RunningParticlePrefabOptions,
) =>
  definePrefab<RunningParticlePrefabProps>({
    name: "running_particle",
    build: (entity: EntityBuilder, props: RunningParticlePrefabProps): void => {
      const clips: Record<string, SpriteAnimation> = opt.clips();
      entity.add(Animator, clips, "default");
      entity.add(AudioSource, opt.sound);

      const renderer: SpriteRenderer = entity.add(SpriteRenderer, opt.sprite);
      renderer.sortingLayer = SortingLayer.Entities;
      renderer.sortingOrder = 100;

      const transform: Transform2D = entity.add(Transform2D);
      transform.scale.set(2, 2);
      transform.position.copyFrom(props.position);

      entity.attach(RunningParticleScript);
    },
  });
