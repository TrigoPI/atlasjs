import { afterEach, describe, expect, it, vi } from "vitest";

import { Engine } from "@atlasjs/core";
import { ASSET_MANAGER, AssetManager, AssetPlugin } from "@atlasjs/assets";

import { AudioPlugin } from "../src/AudioPlugin";
import { AUDIO_ENGINE } from "../src/tokens";
import { AudioEngine } from "../src/AudioEngine";
import { AudioClip } from "../src/assets/AudioClip";
import { AudioClipAsset } from "../src/assets/AudioClipAsset";
import { FakeAudioContext } from "./helpers/fakeAudioContext";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AudioPlugin", () => {
  it("provides AUDIO_ENGINE and registers a working audio loader", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        arrayBuffer: async (): Promise<ArrayBuffer> => new ArrayBuffer(8),
      })),
    );

    const engine: Engine = new Engine({ loop: () => () => {} });
    engine.use(new AssetPlugin()).use(new AudioPlugin());
    await engine.start();

    const audio: AudioEngine = engine.services.get(AUDIO_ENGINE);
    expect(audio).toBeInstanceOf(AudioEngine);

    const manager: AssetManager = engine.services.get(ASSET_MANAGER);
    const clip = await manager.load<AudioClip>(new AudioClipAsset("music.ogg"));
    expect(clip).toBeInstanceOf(AudioClip);
    expect(clip.id).toBe("audio:music.ogg");

    engine.stop();
  });
});
