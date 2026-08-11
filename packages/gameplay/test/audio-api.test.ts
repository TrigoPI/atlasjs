import { describe, expect, it } from "vitest";
import { ServiceRegistry } from "@atlasjs/core";
import { AudioClip, AudioEngine, AUDIO_ENGINE } from "@atlasjs/audio";

import { AudioApi } from "../src/scripting/services/AudioApi";

class FakeEngine {
  public oneShots: Array<[AudioClip, number | undefined]> = [];
  public masterVolume: number = 1;
  public muted: boolean = false;
  public playOneShot(clip: AudioClip, volume?: number): void {
    this.oneShots.push([clip, volume]);
  }
}

const clip: AudioClip = new AudioClip("audio:x", {
  duration: 1,
} as AudioBuffer);

describe("AudioApi", () => {
  it("delegates playOneShot and volume/mute to the backend service", () => {
    const services: ServiceRegistry = new ServiceRegistry();
    const engine: FakeEngine = new FakeEngine();
    services.provide(AUDIO_ENGINE, engine as unknown as AudioEngine);

    const api: AudioApi = new AudioApi(services);
    api.playOneShot(clip, 0.7);
    expect(engine.oneShots).toEqual([[clip, 0.7]]);

    api.masterVolume = 0.3;
    expect(engine.masterVolume).toBe(0.3);
    api.muted = true;
    expect(engine.muted).toBe(true);

    engine.masterVolume = 0.42;
    expect(api.masterVolume).toBe(0.42);
    engine.muted = true;
    expect(api.muted).toBe(true);
  });
});
