import { describe, expect, it } from "vitest";
import { Sprite } from "@atlasjs/nebula";
import type { ParticleBurst, ParticleEmitterConfig } from "@atlasjs/nebula";
import { ParticleEmitter } from "../src/components";
import { fakeTexture } from "./helpers/fakes";

function makeFrames(): ReadonlyArray<Sprite> {
  const sprite: Sprite = new Sprite(fakeTexture("particle", 16, 16));

  return [sprite];
}

function makeConfig(): ParticleEmitterConfig {
  const bursts: readonly ParticleBurst[] = [{ time: 0, count: 12 }];

  return {
    duration: 2,
    looping: false,
    maxParticles: 128,
    rate: 40,
    bursts,
  };
}

describe("ParticleEmitter component", () => {
  it("defaults every field to the documented value", () => {
    const emitter: ParticleEmitter = new ParticleEmitter();

    expect(emitter.config).toEqual({});
    expect(emitter.frames).toHaveLength(0);
    expect(emitter.blend).toEqual("alpha");
    expect(emitter.visible).toEqual(true);
    expect(emitter.sortingLayer).toEqual("Default");
    expect(emitter.sortingOrder).toEqual(0);
    expect(emitter.pendingEmit).toEqual(0);
    expect(emitter.command).toEqual("none");
    expect(emitter.state).toEqual("playing");
  });

  it("starts stopped when playOnAwake is false", () => {
    const emitter: ParticleEmitter = new ParticleEmitter({
      playOnAwake: false,
    });

    expect(emitter.state).toEqual("stopped");
  });

  it("starts playing when playOnAwake is explicitly true", () => {
    const emitter: ParticleEmitter = new ParticleEmitter({ playOnAwake: true });

    expect(emitter.state).toEqual("playing");
  });

  it("takes every field from the options", () => {
    const config: ParticleEmitterConfig = makeConfig();
    const frames: ReadonlyArray<Sprite> = makeFrames();

    const emitter: ParticleEmitter = new ParticleEmitter({
      config,
      frames,
      blend: "additive",
      visible: false,
      sortingLayer: "Entities",
      sortingOrder: 7,
      playOnAwake: false,
    });

    expect(emitter.config).toEqual(config);
    expect(emitter.frames).toHaveLength(1);
    expect(emitter.blend).toEqual("additive");
    expect(emitter.visible).toEqual(false);
    expect(emitter.sortingLayer).toEqual("Entities");
    expect(emitter.sortingOrder).toEqual(7);
    expect(emitter.state).toEqual("stopped");
    expect(emitter.pendingEmit).toEqual(0);
    expect(emitter.command).toEqual("none");
  });

  it("keeps the caller's config object by reference", () => {
    const config: ParticleEmitterConfig = makeConfig();
    const emitter: ParticleEmitter = new ParticleEmitter({ config });

    expect(emitter.config).toBe(config);
  });

  it("keeps the caller's bursts array by reference", () => {
    const bursts: readonly ParticleBurst[] = [{ time: 0.5, count: 4 }];
    const config: ParticleEmitterConfig = { bursts };
    const emitter: ParticleEmitter = new ParticleEmitter({ config });

    expect(emitter.config.bursts).toBe(bursts);
  });

  it("keeps the caller's frames array by reference", () => {
    const frames: ReadonlyArray<Sprite> = makeFrames();
    const emitter: ParticleEmitter = new ParticleEmitter({ frames });

    expect(emitter.frames).toBe(frames);
  });

  it("play() sets the playing state and returns this", () => {
    const emitter: ParticleEmitter = new ParticleEmitter({
      playOnAwake: false,
    });

    expect(emitter.play()).toBe(emitter);
    expect(emitter.state).toEqual("playing");
  });

  it("play() is idempotent", () => {
    const emitter: ParticleEmitter = new ParticleEmitter({
      playOnAwake: false,
    });

    emitter.play();
    emitter.play();

    expect(emitter.state).toEqual("playing");
  });

  it("pause() sets the paused state and returns this", () => {
    const emitter: ParticleEmitter = new ParticleEmitter();

    expect(emitter.pause()).toBe(emitter);
    expect(emitter.state).toEqual("paused");
  });

  it("pause() is idempotent", () => {
    const emitter: ParticleEmitter = new ParticleEmitter();

    emitter.pause();
    emitter.pause();

    expect(emitter.state).toEqual("paused");
  });

  it("stop() sets the stopped state and returns this", () => {
    const emitter: ParticleEmitter = new ParticleEmitter();

    expect(emitter.stop()).toBe(emitter);
    expect(emitter.state).toEqual("stopped");
  });

  it("stop() is idempotent", () => {
    const emitter: ParticleEmitter = new ParticleEmitter();

    emitter.stop();
    emitter.stop();

    expect(emitter.state).toEqual("stopped");
  });

  it("the last state call within a frame wins", () => {
    const emitter: ParticleEmitter = new ParticleEmitter();

    emitter.pause();
    emitter.stop();
    emitter.play();

    expect(emitter.state).toEqual("playing");
  });

  it("emit() accumulates across calls instead of overwriting", () => {
    const emitter: ParticleEmitter = new ParticleEmitter();

    emitter.emit(3);
    emitter.emit(5);

    expect(emitter.pendingEmit).toEqual(8);
  });

  it("emit() returns this", () => {
    const emitter: ParticleEmitter = new ParticleEmitter();

    expect(emitter.emit(2)).toBe(emitter);
  });

  it("emit(0) leaves pendingEmit untouched", () => {
    const emitter: ParticleEmitter = new ParticleEmitter();

    emitter.emit(4);
    emitter.emit(0);

    expect(emitter.pendingEmit).toEqual(4);
  });

  it("emit(-2) leaves pendingEmit untouched", () => {
    const emitter: ParticleEmitter = new ParticleEmitter();

    emitter.emit(4);
    emitter.emit(-2);

    expect(emitter.pendingEmit).toEqual(4);
  });

  it("emit(NaN) does not poison pendingEmit", () => {
    const emitter: ParticleEmitter = new ParticleEmitter();

    emitter.emit(4);
    emitter.emit(Number.NaN);

    expect(emitter.pendingEmit).toEqual(4);

    emitter.emit(2);

    expect(emitter.pendingEmit).toEqual(6);
  });

  it("emit(Infinity) leaves pendingEmit untouched", () => {
    const emitter: ParticleEmitter = new ParticleEmitter();

    emitter.emit(4);
    emitter.emit(Number.POSITIVE_INFINITY);

    expect(emitter.pendingEmit).toEqual(4);
  });

  it("emit(-Infinity) leaves pendingEmit untouched", () => {
    const emitter: ParticleEmitter = new ParticleEmitter();

    emitter.emit(4);
    emitter.emit(Number.NEGATIVE_INFINITY);

    expect(emitter.pendingEmit).toEqual(4);
  });

  it("clear() raises the clear command and returns this", () => {
    const emitter: ParticleEmitter = new ParticleEmitter();

    expect(emitter.clear()).toBe(emitter);
    expect(emitter.command).toEqual("clear");
  });

  it("setConfig() stores the next config by reference and returns this", () => {
    const next: ParticleEmitterConfig = makeConfig();
    const emitter: ParticleEmitter = new ParticleEmitter();

    expect(emitter.setConfig(next)).toBe(emitter);
    expect(emitter.config).toBe(next);
  });

  it("setConfig() preserves the bursts array reference", () => {
    const bursts: readonly ParticleBurst[] = [{ time: 1, count: 3 }];
    const next: ParticleEmitterConfig = { bursts };
    const emitter: ParticleEmitter = new ParticleEmitter();

    emitter.setConfig(next);

    expect(emitter.config.bursts).toBe(bursts);
  });

  it("stop() does not drain a pending emit", () => {
    const emitter: ParticleEmitter = new ParticleEmitter();

    emitter.emit(6);
    emitter.stop();

    expect(emitter.pendingEmit).toEqual(6);
    expect(emitter.state).toEqual("stopped");
  });

  it("emit() does not change the state", () => {
    const emitter: ParticleEmitter = new ParticleEmitter({
      playOnAwake: false,
    });

    emitter.emit(6);

    expect(emitter.state).toEqual("stopped");
  });

  it("clear() does not change the state or the pending emit", () => {
    const emitter: ParticleEmitter = new ParticleEmitter();

    emitter.emit(6);
    emitter.clear();

    expect(emitter.state).toEqual("playing");
    expect(emitter.pendingEmit).toEqual(6);
  });
});

describe("ParticleEmitter blend precedence", () => {
  it("seeds blend from the config when no top level blend is given", () => {
    const emitter: ParticleEmitter = new ParticleEmitter({
      config: { blend: "additive" },
    });

    expect(emitter.blend).toBe("additive");
  });

  it("lets the top level blend win over the config", () => {
    const emitter: ParticleEmitter = new ParticleEmitter({
      blend: "multiply",
      config: { blend: "additive" },
    });

    expect(emitter.blend).toBe("multiply");
  });

  it("falls back on alpha when neither is given", () => {
    const emitter: ParticleEmitter = new ParticleEmitter();

    expect(emitter.blend).toBe("alpha");
  });
});

describe("ParticleEmitter restart", () => {
  it("expresses a retrigger that play cannot, being idempotent", () => {
    const emitter: ParticleEmitter = new ParticleEmitter();

    expect(emitter.state).toBe("playing");
    expect(emitter.command).toBe("none");

    expect(emitter.play().command).toBe("none");
    expect(emitter.restart().command).toBe("restart");
    expect(emitter.state).toBe("playing");
  });

  it("restarts a stopped emitter in one call", () => {
    const emitter: ParticleEmitter = new ParticleEmitter({
      playOnAwake: false,
    });

    emitter.restart();

    expect(emitter.state).toBe("playing");
    expect(emitter.command).toBe("restart");
  });

  it("is chainable and leaves a pending emit alone", () => {
    const emitter: ParticleEmitter = new ParticleEmitter();
    emitter.emit(3);

    expect(emitter.restart()).toBe(emitter);
    expect(emitter.pendingEmit).toEqual(3);
  });
});
