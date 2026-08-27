import { describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import { AtlasScript } from "../src/scripting";
import { Countdown, Repeater, Stopwatch } from "../src/scripting";
import { TIME_SCALE_MANAGER, TimeScaleManager } from "../src/time";
import { createHarness, Harness } from "./helpers/harness";

class TimerProbe extends AtlasScript {
  public watch!: Stopwatch;
  public down!: Countdown;
  public repeat!: Repeater;
  public ticks: number = 0;
  public elapsedAtUpdate: number[] = [];

  public onCreate(): void {
    this.watch = this.stopwatch();
    this.down = this.countdown(0.2);
    this.repeat = this.every(0.2, () => {
      this.ticks += 1;
    });
  }

  public onUpdate(): void {
    this.elapsedAtUpdate.push(this.watch.elapsed);
  }
}

class ThrowingRepeaterProbe extends AtlasScript {
  public created: boolean = false;

  public onCreate(): void {
    this.every(0.05, () => {
      throw new Error("boom");
    });

    this.created = true;
  }
}

type Canceller = { cancel: (handle: Stopwatch) => void };

describe("script timers", () => {
  it("advances the stopwatch with the frame's dt", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    const probe: TimerProbe = harness.scripts.attach(entity, TimerProbe);

    harness.frame();

    expect(probe.watch.elapsed).toBeCloseTo(0.15, 10);
  });

  it("advances the timers before onUpdate", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    const probe: TimerProbe = harness.scripts.attach(entity, TimerProbe);

    harness.frame();

    expect(probe.elapsedAtUpdate).toHaveLength(1);
    expect(probe.elapsedAtUpdate[0]).toBeCloseTo(0.15, 10);
  });

  it("counts down the countdown and declares it done", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    const probe: TimerProbe = harness.scripts.attach(entity, TimerProbe);

    harness.frame();

    expect(probe.down.done).toBe(false);

    harness.frame();

    expect(probe.down.done).toBe(true);
  });

  it("triggers the repeater", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    const probe: TimerProbe = harness.scripts.attach(entity, TimerProbe);

    harness.frame();
    harness.frame();

    expect(probe.ticks).toBe(1);
  });

  it("freezes the timers of a frozen entity", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    const probe: TimerProbe = harness.scripts.attach(entity, TimerProbe);

    harness.frame();
    manager.setScale(entity, 0);
    harness.frame();
    harness.frame();

    expect(probe.watch.elapsed).toBeCloseTo(0.15, 10);
  });

  it("cancel stops a timer's advance", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    const probe: TimerProbe = harness.scripts.attach(entity, TimerProbe);

    harness.frame();

    const frozen: number = probe.watch.elapsed;

    (probe as unknown as Canceller).cancel(probe.watch);
    harness.frame();

    expect(probe.watch.elapsed).toBeCloseTo(frozen, 10);
  });

  it("quarantines the script when a repeater callback throws", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    const probe: ThrowingRepeaterProbe = harness.scripts.attach(
      entity,
      ThrowingRepeaterProbe,
    );

    harness.frame();

    expect(probe.created).toBe(true);
    expect(harness.scripts.isEnabled(probe)).toBe(false);
  });

  it("stops advancing the timers of a destroyed script", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    const probe: TimerProbe = harness.scripts.attach(entity, TimerProbe);

    harness.frame();

    const frozen: number = probe.watch.elapsed;

    harness.world.destroyEntity(entity);
    harness.frame();

    expect(probe.watch.elapsed).toBeCloseTo(frozen, 10);
  });

  it("does not advance the timers of a disabled script", async () => {
    const harness: Harness = await createHarness();
    const entity: Entity = harness.world.createEntity();
    const probe: TimerProbe = harness.scripts.attach(entity, TimerProbe);

    harness.frame();

    const frozen: number = probe.watch.elapsed;

    harness.scripts.setEnabled(probe, false);
    harness.frame();

    expect(probe.watch.elapsed).toBeCloseTo(frozen, 10);
  });

  it("gives each script its own timers", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const first: Entity = harness.world.createEntity();
    const second: Entity = harness.world.createEntity();
    const frozen: TimerProbe = harness.scripts.attach(first, TimerProbe);
    const running: TimerProbe = harness.scripts.attach(second, TimerProbe);

    manager.setScale(first, 0);
    harness.frame();

    expect(frozen.watch.elapsed).toBeCloseTo(0, 10);
    expect(running.watch.elapsed).toBeCloseTo(0.15, 10);
  });
});
