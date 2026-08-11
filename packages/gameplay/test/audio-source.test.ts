import { describe, expect, it } from "vitest";
import { AudioClip } from "@atlasjs/audio";

import { AudioSource } from "../src/components/AudioSource";

const clip: AudioClip = new AudioClip("audio:x", {
  duration: 1,
} as AudioBuffer);

describe("AudioSource", () => {
  it("defaults: silent, non-looping, not playing", () => {
    const source: AudioSource = new AudioSource();
    expect(source.clip).toBeNull();
    expect(source.volume).toBe(1);
    expect(source.loop).toBe(false);
    expect(source.mute).toBe(false);
    expect(source.playOnAwake).toBe(false);
    expect(source.command).toBe("none");
    expect(source.isPlaying).toBe(false);
  });

  it("applies constructor options", () => {
    const source: AudioSource = new AudioSource(clip, {
      volume: 0.5,
      loop: true,
      mute: true,
      playOnAwake: true,
    });
    expect(source.clip).toBe(clip);
    expect(source.volume).toBe(0.5);
    expect(source.loop).toBe(true);
    expect(source.mute).toBe(true);
    expect(source.playOnAwake).toBe(true);
  });

  it("play() and stop() set the command and chain", () => {
    const source: AudioSource = new AudioSource(clip);
    expect(source.play()).toBe(source);
    expect(source.command).toBe("play");
    expect(source.stop()).toBe(source);
    expect(source.command).toBe("stop");
  });
});
