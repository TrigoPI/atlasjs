import { beforeEach, describe, expect, it } from "vitest";

import { Engine } from "../src/public/engine/Engine";
import { StepContext } from "../src/public/engine/types";

class ManualLoop {
  public onTick: ((dt: number) => void) | null = null;
  public stopped = false;

  public readonly factory = (cb: (dt: number) => void) => {
    this.onTick = cb;
    return () => {
      this.stopped = true;
    };
  };

  public frame(dt: number): void {
    if (!this.onTick) throw new Error("loop not started");
    this.onTick(dt);
  }
}

const FIXED = 0.1;

describe("Engine — frame loop", () => {
  let loop: ManualLoop;
  let engine: Engine;
  let order: string[];
  let renderCtx: StepContext | null;
  let fixedCtx: StepContext | null;

  beforeEach(async () => {
    loop = new ManualLoop();
    engine = new Engine({
      fixedDelta: FIXED,
      maxSubSteps: 5,
      loop: loop.factory,
    });

    order = [];
    renderCtx = null;
    fixedCtx = null;

    engine.scheduler.fixed.add(
      (ctx) => {
        order.push("fixed");
        fixedCtx = ctx;
      },
      { name: "test:fixed", stage: "PreSim" },
    );
    engine.scheduler.update.add(() => order.push("update"), {
      name: "test:update",
      stage: "Logic",
    });
    engine.scheduler.render.add(
      (ctx) => {
        order.push("render");
        renderCtx = ctx;
      },
      { name: "test:render", stage: "Main" },
    );

    await engine.start();
  });

  it("runs lanes in order: fixed (xN) -> update -> render", () => {
    loop.frame(2.5 * FIXED); // acc = 0.25 -> two fixed steps, 0.05 leftover

    expect(order).toEqual(["fixed", "fixed", "update", "render"]);
  });

  it("exposes the interpolation alpha on the render context", () => {
    loop.frame(2.5 * FIXED); // leftover acc = 0.05 -> alpha 0.5

    expect(renderCtx?.alpha).toBeCloseTo(0.5, 5);
  });

  it("passes fixedDelta as dt to the fixed lane", () => {
    loop.frame(2.5 * FIXED);

    expect(fixedCtx?.dt).toBeCloseTo(FIXED, 10);
  });

  it("caps fixed steps at maxSubSteps and increments tick", () => {
    loop.frame(100 * FIXED); // would be 100 steps, capped at 5

    const fixedRuns = order.filter((s) => s === "fixed").length;
    expect(fixedRuns).toBe(5);
    expect(fixedCtx?.tick).toBe(5);
  });

  it("advances the frame counter once per frame", () => {
    loop.frame(FIXED);
    loop.frame(FIXED);

    expect(renderCtx?.frame).toBe(2);
  });

  it("stops the loop on engine.stop()", () => {
    engine.stop();
    expect(loop.stopped).toBe(true);
  });
});
