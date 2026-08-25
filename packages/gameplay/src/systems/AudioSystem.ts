import { ServiceRegistry } from "@atlasjs/core";
import { Entity, NexusSystem, NexusSystemContext } from "@atlasjs/nexus";
import { AUDIO_ENGINE, AudioEngine, AudioVoice } from "@atlasjs/audio";

import { AudioSource } from "../components/AudioSource";

const MISSING_AUDIO_ENGINE: string =
  'AudioSource playback requires an AudioEngine, but no service is registered under AUDIO_ENGINE. Install the audio plugin before starting the engine — import { AudioPlugin } from "@atlasjs/audio" then engine.use(new AudioPlugin()) — or remove the AudioSource component if this project has no audio.';

export class AudioSystem implements NexusSystem {
  private readonly services: ServiceRegistry;
  private readonly voices: Map<AudioSource, AudioVoice>;
  private engine: AudioEngine | undefined;

  public constructor(services: ServiceRegistry) {
    this.services = services;
    this.voices = new Map<AudioSource, AudioVoice>();
    this.engine = undefined;
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
      const engine: AudioEngine = this.requireEngine();
      const voice: AudioVoice = engine.createVoice(source.clip, {
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

  private requireEngine(): AudioEngine {
    let engine: AudioEngine | undefined = this.engine;

    if (engine === undefined) {
      if (!this.services.has(AUDIO_ENGINE)) {
        throw new Error(MISSING_AUDIO_ENGINE);
      }
      engine = this.services.get(AUDIO_ENGINE);
      this.engine = engine;
    }

    return engine;
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
