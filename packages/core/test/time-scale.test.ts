import { describe, expect, it } from "vitest";

import { Engine } from "../src/public/engine/Engine";
import { TIME, TimeControl } from "../src/public/engine/TimeControl";

type Tick = (dt: number) => void;

function createEngine(timeScale?: number): { engine: Engine; tick: Tick } {
  let onTick: Tick = () => {};

  const engine = new Engine({
    fixedDelta: 0.1,
    maxSubSteps: 64,
    timeScale,
    loop: (cb: Tick) => {
      onTick = cb;
      return () => {};
    },
  });

  return { engine, tick: (dt: number): void => onTick(dt) };
}

describe("Engine time scale", () => {
  it("runs at real time by default", async () => {
    const { engine, tick } = createEngine();
    const seen: number[] = [];

    engine.scheduler.update.add((ctx) => seen.push(ctx.dt), {
      name: "probe",
      stage: "Logic",
    });

    await engine.start();
    tick(0.5);

    expect(engine.timeScale).toBe(1);
    expect(seen).toEqual([0.5]);
  });

  it("scales the delta handed to the update lane", async () => {
    const { engine, tick } = createEngine();
    const seen: number[] = [];

    engine.scheduler.update.add((ctx) => seen.push(ctx.dt), {
      name: "probe",
      stage: "Logic",
    });

    await engine.start();
    engine.timeScale = 0.5;
    tick(0.5);

    expect(seen).toEqual([0.25]);
  });

  it("stops running fixed steps entirely when frozen", async () => {
    const { engine, tick } = createEngine();
    let fixedSteps: number = 0;

    engine.scheduler.fixed.add(() => fixedSteps++, {
      name: "probe",
      stage: "ScriptFixed",
    });

    await engine.start();

    tick(0.5);
    expect(fixedSteps).toBe(5);

    engine.timeScale = 0;
    tick(0.5);
    expect(fixedSteps).toBe(5);

    engine.timeScale = 1;
    tick(0.5);
    expect(fixedSteps).toBe(10);
  });

  it("still runs the render lane while frozen", async () => {
    const { engine, tick } = createEngine();
    let renders: number = 0;

    engine.scheduler.render.add(() => renders++, {
      name: "probe",
      stage: "Main",
    });

    await engine.start();
    engine.timeScale = 0;
    tick(0.5);

    expect(renders).toBe(1);
  });

  it("accepts an initial scale from the options", async () => {
    const { engine, tick } = createEngine(0.25);
    const seen: number[] = [];

    engine.scheduler.update.add((ctx) => seen.push(ctx.dt), {
      name: "probe",
      stage: "Logic",
    });

    await engine.start();
    tick(0.4);

    expect(seen).toEqual([0.1]);
  });

  it("refuses a negative or non-finite scale", () => {
    const { engine } = createEngine();

    engine.timeScale = -3;
    expect(engine.timeScale).toBe(0);

    engine.timeScale = Number.NaN;
    expect(engine.timeScale).toBe(1);
  });

  it("exposes the scale through the TIME service", async () => {
    const { engine } = createEngine();

    await engine.start();

    const time: TimeControl = engine.services.get(TIME);

    expect(time.scale).toBe(1);

    time.scale = 0;
    expect(engine.timeScale).toBe(0);

    engine.timeScale = 0.5;
    expect(time.scale).toBe(0.5);
  });
});
