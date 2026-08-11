import { describe, expect, it } from "vitest";

import { AudioClipAsset } from "../src/assets/AudioClipAsset";
import { AudioClip } from "../src/assets/AudioClip";

describe("AudioClipAsset", () => {
  it("derives a deterministic id from the source", () => {
    const asset: AudioClipAsset = new AudioClipAsset("sfx/hit.wav");
    expect(asset.type).toBe("audio");
    expect(asset.id).toBe("audio:sfx/hit.wav");
    expect(asset.source).toBe("sfx/hit.wav");
  });

  it("honors an explicit id override", () => {
    const asset: AudioClipAsset = new AudioClipAsset("sfx/hit.wav", {
      id: "custom",
    });
    expect(asset.id).toBe("custom");
  });
});

describe("AudioClip", () => {
  it("exposes id, buffer and duration, and destroy is a no-op", () => {
    const buffer: AudioBuffer = { duration: 2.5 } as AudioBuffer;
    const clip: AudioClip = new AudioClip("audio:x", buffer);
    expect(clip.id).toBe("audio:x");
    expect(clip.buffer).toBe(buffer);
    expect(clip.duration).toBe(2.5);
    expect(() => clip.destroy()).not.toThrow();
  });
});
