import type { AudioClip } from "@atlasjs/audio";
import { pickRandom, randomRange } from "@atlasjs/utils";

import {
  AudioSource,
  definePrefab,
  type EntityBuilder,
  type Prefab,
} from "@atlasjs/gameplay";

export type RunningAudioPrefabDeps = {
  sound: AudioClip;
};

export function createRunningAudioPrefab(deps: RunningAudioPrefabDeps): Prefab {
  return definePrefab({
    name: "running_audio",
    build: (entity: EntityBuilder): void => {
      const audio: AudioSource = entity.add(
        AudioSource,
        pickRandom([deps.sound]),
        { playOnAwake: true },
      );

      audio.volume = randomRange(0.01, 0.05);
      audio.pitch = randomRange(1, 1.2);
    },
  });
}
