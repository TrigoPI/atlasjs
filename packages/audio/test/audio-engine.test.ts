import { describe, expect, it } from "vitest";

import { AudioEngine, VisibilityDoc } from "../src/AudioEngine";
import { AudioClip } from "../src/assets/AudioClip";
import {
  FakeAudioContext,
  FakeBufferSourceNode,
} from "./helpers/fakeAudioContext";

class FlakyResumeContext extends FakeAudioContext {
  public failuresLeft: number;
  public constructor(failures: number) {
    super();
    this.failuresLeft = failures;
  }
  public async resume(): Promise<void> {
    if (this.failuresLeft > 0) {
      this.failuresLeft--;
      this.resumeCalls++;
      throw new Error("resume blocked");
    }
    return super.resume();
  }
}

class FakeDoc implements VisibilityDoc {
  public hidden: boolean = false;
  private readonly listeners: Map<string, () => void> = new Map();
  public addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, listener);
  }
  public removeEventListener(type: string): void {
    this.listeners.delete(type);
  }
  public fire(type: string): void {
    this.listeners.get(type)?.();
  }
  public has(type: string): boolean {
    return this.listeners.has(type);
  }
}

const clip: AudioClip = new AudioClip("audio:x", {
  duration: 1,
} as AudioBuffer);

function make(): {
  engine: AudioEngine;
  ctx: FakeAudioContext;
  target: EventTarget;
  doc: FakeDoc;
} {
  const ctx: FakeAudioContext = new FakeAudioContext();
  const target: EventTarget = new EventTarget();
  const doc: FakeDoc = new FakeDoc();
  const engine: AudioEngine = new AudioEngine(ctx as unknown as AudioContext, {
    target,
    doc,
  });
  return { engine, ctx, target, doc };
}

describe("AudioEngine", () => {
  it("creates and connects a master gain to the destination", () => {
    const { engine, ctx } = make();
    expect(ctx.gains).toHaveLength(1);
    expect(ctx.gains[0].connections).toContain(ctx.destination);
    engine.destroy();
  });

  it("playOneShot wires a source through a gain into master and starts it", () => {
    const { engine, ctx } = make();
    engine.playOneShot(clip, { volume: 0.5 });
    const source: FakeBufferSourceNode = ctx.sources[0];
    expect(source.buffer).toBe(clip.buffer);
    expect(source.started).toBe(true);
    engine.destroy();
  });

  it("masterVolume and muted drive the master gain", () => {
    const { engine, ctx } = make();
    engine.masterVolume = 0.3;
    expect(ctx.gains[0].gain.value).toBeCloseTo(0.3);
    engine.muted = true;
    expect(ctx.gains[0].gain.value).toBe(0);
    engine.muted = false;
    expect(ctx.gains[0].gain.value).toBeCloseTo(0.3);
    engine.destroy();
  });

  it("createVoice returns a live handle whose apply and stop drive the nodes", () => {
    const { engine, ctx } = make();
    const voice = engine.createVoice(clip, {
      loop: true,
      volume: 1,
      mute: false,
    });
    const source: FakeBufferSourceNode = ctx.sources[0];
    expect(source.loop).toBe(true);
    expect(source.started).toBe(true);
    voice.apply(0.2, false, 1);
    expect(ctx.gains[1].gain.value).toBeCloseTo(0.2);
    voice.apply(0.2, true, 1);
    expect(ctx.gains[1].gain.value).toBe(0);
    expect(voice.finished).toBe(false);
    voice.stop();
    expect(source.stopped).toBe(true);
    expect(voice.finished).toBe(true);
    engine.destroy();
  });

  it("marks a voice finished when its source ends naturally", () => {
    const { engine, ctx } = make();
    const voice = engine.createVoice(clip, {
      loop: false,
      volume: 1,
      mute: false,
    });
    ctx.sources[0].onended?.();
    expect(voice.finished).toBe(true);
    engine.destroy();
  });

  it("resumes the context on the first gesture, then stops listening", async () => {
    const { engine, ctx, target } = make();
    target.dispatchEvent(new Event("pointerdown"));
    await Promise.resolve();
    expect(ctx.resumeCalls).toBe(1);
    target.dispatchEvent(new Event("pointerdown"));
    await Promise.resolve();
    expect(ctx.resumeCalls).toBe(1);
    engine.destroy();
  });

  it("suspends on tab hide and resumes on show once unlocked", async () => {
    const { engine, ctx, target, doc } = make();
    target.dispatchEvent(new Event("pointerdown"));
    await Promise.resolve();
    doc.hidden = true;
    doc.fire("visibilitychange");
    expect(ctx.suspendCalls).toBe(1);
    doc.hidden = false;
    doc.fire("visibilitychange");
    expect(ctx.resumeCalls).toBe(2);
    engine.destroy();
  });

  it("retries unlock on the next gesture after a resume rejection", async () => {
    const ctx: FlakyResumeContext = new FlakyResumeContext(1);
    const target: EventTarget = new EventTarget();
    const engine: AudioEngine = new AudioEngine(
      ctx as unknown as AudioContext,
      {
        target,
      },
    );
    target.dispatchEvent(new Event("pointerdown"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    target.dispatchEvent(new Event("pointerdown"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ctx.resumeCalls).toBe(2);
    expect(ctx.state).toBe("running");
    engine.destroy();
  });

  it("destroy closes the context and removes the visibility listener", () => {
    const { engine, ctx, doc } = make();
    engine.destroy();
    expect(ctx.closed).toBe(true);
    expect(doc.has("visibilitychange")).toBe(false);
  });

  it("playOneShot applies pitch to the source playbackRate", () => {
    const { engine, ctx } = make();
    engine.playOneShot(clip, { volume: 1, pitch: 1.5 });
    expect(ctx.sources[0].playbackRate.value).toBeCloseTo(1.5);
    engine.destroy();
  });

  it("playOneShot defaults pitch to 1", () => {
    const { engine, ctx } = make();
    engine.playOneShot(clip);
    expect(ctx.sources[0].playbackRate.value).toBe(1);
    engine.destroy();
  });

  it("createVoice sets the initial playbackRate from pitch", () => {
    const { engine, ctx } = make();
    engine.createVoice(clip, {
      loop: false,
      volume: 1,
      mute: false,
      pitch: 0.5,
    });
    expect(ctx.sources[0].playbackRate.value).toBeCloseTo(0.5);
    engine.destroy();
  });

  it("apply updates playbackRate live and clamps negatives to 0", () => {
    const { engine, ctx } = make();
    const voice = engine.createVoice(clip, {
      loop: true,
      volume: 1,
      mute: false,
    });
    expect(ctx.sources[0].playbackRate.value).toBe(1);
    voice.apply(1, false, 2);
    expect(ctx.sources[0].playbackRate.value).toBeCloseTo(2);
    voice.apply(1, false, -3);
    expect(ctx.sources[0].playbackRate.value).toBe(0);
    engine.destroy();
  });
});
