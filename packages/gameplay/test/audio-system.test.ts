import { describe, expect, it } from "vitest";
import { ServiceRegistry } from "@atlasjs/core";
import { NexusWorld, ComponentRegistry, Entity } from "@atlasjs/nexus";
import {
  AUDIO_ENGINE,
  AudioClip,
  AudioEngine,
  AudioVoice,
} from "@atlasjs/audio";

import { AudioSource } from "../src/components/AudioSource";
import { AudioSystem } from "../src/systems/AudioSystem";

class FakeVoice implements AudioVoice {
  public finished: boolean = false;
  public applied: Array<[number, boolean, number]> = [];
  public stopped: boolean = false;
  public apply(volume: number, muted: boolean, pitch: number): void {
    this.applied.push([volume, muted, pitch]);
  }
  public stop(): void {
    this.stopped = true;
    this.finished = true;
  }
}

class FakeEngine {
  public voices: FakeVoice[] = [];
  public lastOpts: {
    loop: boolean;
    volume: number;
    mute: boolean;
    pitch?: number;
  } | null = null;
  public createVoice(
    _clip: AudioClip,
    opts: { loop: boolean; volume: number; mute: boolean; pitch?: number },
  ): AudioVoice {
    this.lastOpts = opts;
    const voice: FakeVoice = new FakeVoice();
    this.voices.push(voice);
    return voice;
  }
}

const clip: AudioClip = new AudioClip("audio:x", {
  duration: 1,
} as AudioBuffer);

function servicesWith(engine: FakeEngine): ServiceRegistry {
  const services: ServiceRegistry = new ServiceRegistry();
  services.provide(AUDIO_ENGINE, engine as unknown as AudioEngine);
  return services;
}

function setup(): {
  world: NexusWorld;
  engine: FakeEngine;
  system: AudioSystem;
  source: AudioSource;
} {
  const world: NexusWorld = new NexusWorld(new ComponentRegistry());
  world.defineComponent(AudioSource);
  const engine: FakeEngine = new FakeEngine();
  const system: AudioSystem = new AudioSystem(servicesWith(engine));
  const entity: Entity = world.createEntity();
  world.addComponent(entity, AudioSource, clip, { loop: true, volume: 0.5 });
  const source: AudioSource = world.requireComponent(entity, AudioSource);
  return { world, engine, system, source };
}

describe("AudioSystem", () => {
  it("play command creates a voice with the source's options and marks it playing", () => {
    const { world, engine, system, source } = setup();
    source.play();
    system.update({ world, dt: 0 });
    expect(engine.voices).toHaveLength(1);
    expect(engine.lastOpts).toEqual({
      loop: true,
      volume: 0.5,
      mute: false,
      pitch: 1,
    });
    expect(source.command).toBe("none");
    expect(source.isPlaying).toBe(true);
  });

  it("skips play when there is no clip", () => {
    const world: NexusWorld = new NexusWorld(new ComponentRegistry());
    world.defineComponent(AudioSource);
    const engine: FakeEngine = new FakeEngine();
    const system: AudioSystem = new AudioSystem(servicesWith(engine));
    const entity: Entity = world.createEntity();
    world.addComponent(entity, AudioSource);
    world.requireComponent(entity, AudioSource).play();
    system.update({ world, dt: 0 });
    expect(engine.voices).toHaveLength(0);
  });

  it("pushes live volume and mute to the active voice each frame", () => {
    const { world, engine, system, source } = setup();
    source.play();
    system.update({ world, dt: 0 });
    source.volume = 0.2;
    source.mute = true;
    system.update({ world, dt: 0 });
    expect(engine.voices[0].applied.at(-1)).toEqual([0.2, true, 1]);
  });

  it("stop command stops the voice and clears playing", () => {
    const { world, engine, system, source } = setup();
    source.play();
    system.update({ world, dt: 0 });
    source.stop();
    system.update({ world, dt: 0 });
    expect(engine.voices[0].stopped).toBe(true);
    expect(source.isPlaying).toBe(false);
  });

  it("sweeps a naturally finished voice and clears playing", () => {
    const { world, engine, system, source } = setup();
    source.play();
    system.update({ world, dt: 0 });
    engine.voices[0].finished = true;
    system.update({ world, dt: 0 });
    expect(source.isPlaying).toBe(false);
  });

  it("release stops the voice (used by onRemove)", () => {
    const { world, engine, system, source } = setup();
    source.play();
    system.update({ world, dt: 0 });
    system.release(source);
    expect(engine.voices[0].stopped).toBe(true);
    expect(source.isPlaying).toBe(false);
  });

  it("passes the source pitch to createVoice and pushes it live", () => {
    const { world, engine, system, source } = setup();
    source.pitch = 1.5;
    source.play();
    system.update({ world, dt: 0 });
    expect(engine.lastOpts?.pitch).toBe(1.5);
    source.pitch = 0.75;
    system.update({ world, dt: 0 });
    expect(engine.voices[0].applied.at(-1)).toEqual([0.5, false, 0.75]);
  });
});
