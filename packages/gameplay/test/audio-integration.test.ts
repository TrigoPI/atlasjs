import { describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";
import { AudioClip } from "@atlasjs/audio";

import { AudioSource } from "../src/components/AudioSource";
import { createHarness, Harness } from "./helpers/harness";

const clip: AudioClip = new AudioClip("audio:x", {
  duration: 1,
} as AudioBuffer);

describe("GameplayPlugin audio wiring", () => {
  it("playOnAwake starts a voice after a frame", async () => {
    const h: Harness = await createHarness();
    const entity: Entity = h.world.createEntity();
    h.world.addComponent(entity, AudioSource, clip, {
      loop: true,
      playOnAwake: true,
    });

    h.frame();

    expect(h.audio.voices).toHaveLength(1);
    expect(h.world.requireComponent(entity, AudioSource).isPlaying).toBe(true);
  });

  it("destroying the entity stops its voice (onRemove → release)", async () => {
    const h: Harness = await createHarness();
    const entity: Entity = h.world.createEntity();
    h.world.addComponent(entity, AudioSource, clip, {
      loop: true,
      playOnAwake: true,
    });
    h.frame();

    h.world.destroyEntity(entity);

    expect(h.audio.voices[0].stopped).toBe(true);
  });
});
