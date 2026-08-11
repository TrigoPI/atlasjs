import { Entity, NexusSystem, NexusSystemContext } from "@atlasjs/nexus";
import { AudioEngine, AudioVoice } from "@atlasjs/audio";

import { AudioSource } from "../components/AudioSource";

export class AudioSystem implements NexusSystem {
  private readonly engine: AudioEngine;
  private readonly voices: Map<AudioSource, AudioVoice>;

  public constructor(engine: AudioEngine) {
    this.engine = engine;
    this.voices = new Map<AudioSource, AudioVoice>();
  }

  public update({ world }: NexusSystemContext): void {
    this.sweepFinished();
    world.query(AudioSource).each((_entity: Entity, source: AudioSource) => {
      this.consumeCommand(source);
      this.pushLiveState(source);
    });
  }

  public release(source: AudioSource): void {
    this.stopVoice(source);
    source.isPlaying = false;
  }

  private consumeCommand(source: AudioSource): void {
    const command: AudioSource["command"] = source.command;
    source.command = "none";

    if (command === "play") {
      this.stopVoice(source);
      if (source.clip === null) {
        source.isPlaying = false;
        return;
      }
      const voice: AudioVoice = this.engine.createVoice(source.clip, {
        loop: source.loop,
        volume: source.volume,
        mute: source.mute,
        pitch: source.pitch,
      });
      this.voices.set(source, voice);
      source.isPlaying = true;
    } else if (command === "stop") {
      this.stopVoice(source);
      source.isPlaying = false;
    }
  }

  private pushLiveState(source: AudioSource): void {
    const voice: AudioVoice | undefined = this.voices.get(source);
    if (voice === undefined) {
      return;
    }
    voice.apply(source.volume, source.mute, source.pitch);
  }

  private sweepFinished(): void {
    for (const [source, voice] of this.voices) {
      if (voice.finished) {
        this.voices.delete(source);
        source.isPlaying = false;
      }
    }
  }

  private stopVoice(source: AudioSource): void {
    const voice: AudioVoice | undefined = this.voices.get(source);
    if (voice === undefined) {
      return;
    }
    voice.stop();
    this.voices.delete(source);
  }
}
