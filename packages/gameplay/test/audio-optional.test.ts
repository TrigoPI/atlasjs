import { describe, expect, it, vi } from "vitest";
import { ServiceToken } from "@atlasjs/core";
import { Entity } from "@atlasjs/nexus";
import { AUDIO_ENGINE, AudioClip } from "@atlasjs/audio";

import { AudioSource } from "../src/components/AudioSource";
import { Transform2D } from "../src/components/Transform2D";
import { createHarness, Harness } from "./helpers/harness";

const clip: AudioClip = new AudioClip("audio:x", {
  duration: 1,
} as AudioBuffer);

describe("gameplay without an AUDIO_ENGINE", () => {
  it("boots the engine when no audio plugin is installed", async () => {
    const harness: Harness = await createHarness({ audio: false });

    expect(harness.services.has(AUDIO_ENGINE)).toBe(false);
    expect(harness.world).toBeDefined();
    expect(harness.scripts).toBeDefined();
  });

  it("runs frames without ever resolving the audio token", async () => {
    const harness: Harness = await createHarness({ audio: false });
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, Transform2D);

    const get = vi.spyOn(harness.services, "get");

    harness.frame();
    harness.frame();
    harness.frame();

    const audioLookups: ServiceToken<unknown>[] = get.mock.calls
      .map((call: [ServiceToken<unknown>]) => call[0])
      .filter((token: ServiceToken<unknown>) => token === AUDIO_ENGINE);

    expect(audioLookups).toHaveLength(0);
  });

  it("resolves the audio token once and memoizes it across frames", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, AudioSource, clip);
    const source: AudioSource = harness.world.requireComponent(
      entity,
      AudioSource,
    );

    const get = vi.spyOn(harness.services, "get");

    source.play();
    harness.frame();
    harness.frame();
    source.play();
    harness.frame();

    const audioLookups: ServiceToken<unknown>[] = get.mock.calls
      .map((call: [ServiceToken<unknown>]) => call[0])
      .filter((token: ServiceToken<unknown>) => token === AUDIO_ENGINE);

    expect(audioLookups).toHaveLength(1);
    expect(harness.audio.voices).toHaveLength(2);
  });

  it("throws an actionable error when an AudioSource actually plays", async () => {
    const harness: Harness = await createHarness({ audio: false });
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, AudioSource, clip);
    harness.world.requireComponent(entity, AudioSource).play();

    let message: string = "";
    try {
      harness.frame();
    } catch (error: unknown) {
      message = (error as Error).message;
    }

    expect(message).toContain("AUDIO_ENGINE");
    expect(message).toContain("AudioPlugin");
    expect(message).toContain("@atlasjs/audio");
  });
});
