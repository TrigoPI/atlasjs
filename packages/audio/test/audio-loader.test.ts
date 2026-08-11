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
      ok: true,
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

  it("rejects with a clear error when the response is not ok", async () => {
    const engine = {
      decode: vi.fn(async (_data: ArrayBuffer) => ({}) as AudioBuffer),
    } as unknown as AudioEngine;
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 404,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const loader: AudioLoader = new AudioLoader(engine);

    await expect(
      loader.load(new AudioClipAsset("missing.wav")),
    ).rejects.toThrow(/404/);
    expect(engine.decode).not.toHaveBeenCalled();
  });
});
