import { randomRange } from "@atlasjs/utils";

import {
  type GameEntity,
  AtlasScript,
  AudioSource,
  Tag,
} from "@atlasjs/gameplay";

export class PlayerSoundScript extends AtlasScript {
  public onCollisionEnter(other: GameEntity): void {
    if (!other.hasComponent(Tag)) {
      return;
    }

    const tag: Tag = other.requireComponent(Tag);

    if (tag.value !== "Player") {
      return;
    }

    const audioSource: AudioSource = this.requireComponent(AudioSource);

    audioSource.volume = randomRange(0.1, 0.3);
    audioSource.pitch = randomRange(0.8, 1.2);

    audioSource.play();
  }
}
