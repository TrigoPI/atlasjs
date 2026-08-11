import { afterEach, describe, expect, it, vi } from "vitest";

import { AudioEngine } from "../src/AudioEngine";
import { AudioClipAsset } from "../src/assets/AudioClipAsset";
import { AudioLoader } from "../src/assets/AudioLoader";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AudioLoader", () => {
  it("fetches the source, decodes it, and returns an AudioClip", async () => {
    const buffer: AudioBuffer = { duration: 2 } as AudioBuffer;
    const engine = {
      decode: vi.fn(async (_data: ArrayBuffer) => buffer),
    } as unknown as AudioEngine;
    const fetchMock = vi.fn(async () => ({
      arrayBuffer: async (): Promise<ArrayBuffer> => new ArrayBuffer(8),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const loader: AudioLoader = new AudioLoader(engine);
    expect(loader.type).toBe("audio");

    const clip = await loader.load(new AudioClipAsset("sfx/hit.wav"));

    expect(fetchMock).toHaveBeenCalledWith("sfx/hit.wav");
    expect(clip.id).toBe("audio:sfx/hit.wav");
    expect(clip.buffer).toBe(buffer);
  });
});
