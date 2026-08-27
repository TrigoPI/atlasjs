import { describe, expect, it } from "vitest";

import { AtlasScript } from "../src/scripting";
import { Stopwatch } from "../src/scripting";
import { ScriptHarness, createScriptHarness } from "../src/testing";

class HarnessTimerProbe extends AtlasScript {
  public watch!: Stopwatch;
  public ticks: number = 0;
  public elapsedAtUpdate: number[] = [];

  public onCreate(): void {
    this.watch = this.stopwatch();
    this.every(0.1, () => {
      this.ticks += 1;
    });
  }

  public onUpdate(): void {
    this.elapsedAtUpdate.push(this.watch.elapsed);
  }
}

describe("createScriptHarness timers", () => {
  it("advance drives a script's stopwatch", () => {
    const harness: ScriptHarness<HarnessTimerProbe> =
      createScriptHarness(HarnessTimerProbe);

    harness.create();
    harness.advance(0.25);

    expect(harness.script.watch.elapsed).toBeCloseTo(0.25, 10);
  });

  it("advance runs the timers before onUpdate", () => {
    const harness: ScriptHarness<HarnessTimerProbe> =
      createScriptHarness(HarnessTimerProbe);

    harness.create();
    harness.advance(0.25);

    expect(harness.script.elapsedAtUpdate).toHaveLength(1);
    expect(harness.script.elapsedAtUpdate[0]).toBeCloseTo(0.25, 10);
  });

  it("advance fires a repeater callback", () => {
    const harness: ScriptHarness<HarnessTimerProbe> =
      createScriptHarness(HarnessTimerProbe);

    harness.create();
    harness.advance(0.15);

    expect(harness.script.ticks).toBe(1);
  });

  it("two harnesses do not share timers", () => {
    const advanced: ScriptHarness<HarnessTimerProbe> =
      createScriptHarness(HarnessTimerProbe);
    const untouched: ScriptHarness<HarnessTimerProbe> =
      createScriptHarness(HarnessTimerProbe);

    advanced.create();
    untouched.create();
    advanced.advance(0.25);

    expect(advanced.script.watch.elapsed).toBeCloseTo(0.25, 10);
    expect(untouched.script.watch.elapsed).toBeCloseTo(0, 10);
  });
});
