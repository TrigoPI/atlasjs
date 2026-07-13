import { describe, expect, it } from "vitest";

import { Scheduler, SchedulerCycleError } from "../src/public/engine/Scheduler";
import { StepContext } from "../src/public/engine/types";

const CTX: StepContext = {
  dt: 1 / 60,
  alpha: 1,
  tick: 0,
  frame: 0,
  elapsed: 0,
};

function trace(): { log: string[]; push: (name: string) => () => void } {
  const log: string[] = [];
  return { log, push: (name: string) => () => log.push(name) };
}

describe("Scheduler — stage ordering", () => {
  it("runs steps in stage order regardless of insertion order", () => {
    const s = new Scheduler();
    const t = trace();

    // Register in reverse stage order on purpose.
    s.fixed.add(t.push("cleanup"), { name: "cleanup", stage: "Cleanup" });
    s.fixed.add(t.push("step"), { name: "step", stage: "PhysicsStep" });
    s.fixed.add(t.push("presim"), { name: "presim", stage: "PreSim" });

    s.runLane("fixed", CTX);

    expect(t.log).toEqual(["presim", "step", "cleanup"]);
  });

  it("orders within a stage by before/after constraints", () => {
    const s = new Scheduler();
    const t = trace();

    s.fixed.add(t.push("b"), {
      name: "b",
      stage: "PhysicsRequest",
      after: "a",
    });
    s.fixed.add(t.push("a"), { name: "a", stage: "PhysicsRequest" });
    s.fixed.add(t.push("c"), {
      name: "c",
      stage: "PhysicsRequest",
      after: "b",
    });

    s.runLane("fixed", CTX);

    expect(t.log).toEqual(["a", "b", "c"]);
  });

  it("breaks ties by insertion order", () => {
    const s = new Scheduler();
    const t = trace();

    s.update.add(t.push("first"), { name: "first", stage: "Logic" });
    s.update.add(t.push("second"), { name: "second", stage: "Logic" });
    s.update.add(t.push("third"), { name: "third", stage: "Logic" });

    s.runLane("update", CTX);

    expect(t.log).toEqual(["first", "second", "third"]);
  });

  it("honours `before` as the mirror of `after`", () => {
    const s = new Scheduler();
    const t = trace();

    s.render.add(t.push("main"), { name: "main", stage: "Main" });
    s.render.add(t.push("pre"), {
      name: "pre",
      stage: "Main",
      before: "main",
    });

    s.runLane("render", CTX);

    expect(t.log).toEqual(["pre", "main"]);
  });
});

describe("Scheduler — validation", () => {
  it("throws on an unknown stage", () => {
    const s = new Scheduler();
    expect(() => s.fixed.add(() => {}, { name: "x", stage: "Nope" })).toThrow(
      /Unknown stage/,
    );
  });

  it("throws on a duplicate step name in a lane", () => {
    const s = new Scheduler();
    s.fixed.add(() => {}, { name: "dup", stage: "PreSim" });
    expect(() =>
      s.fixed.add(() => {}, { name: "dup", stage: "Cleanup" }),
    ).toThrow(/Duplicate step name/);
  });

  it("throws on a cross-stage before/after reference", () => {
    const s = new Scheduler();
    s.fixed.add(() => {}, { name: "a", stage: "PreSim" });
    s.fixed.add(() => {}, { name: "b", stage: "Cleanup", after: "a" });
    expect(() => s.runLane("fixed", CTX)).toThrow(/same stage/);
  });

  it("throws SchedulerCycleError on a cycle", () => {
    const s = new Scheduler();
    s.fixed.add(() => {}, { name: "a", stage: "PreSim", after: "b" });
    s.fixed.add(() => {}, { name: "b", stage: "PreSim", after: "a" });
    expect(() => s.runLane("fixed", CTX)).toThrow(SchedulerCycleError);
  });
});

describe("Scheduler — handles", () => {
  it("remove() unregisters a step", () => {
    const s = new Scheduler();
    const t = trace();

    const handle = s.update.add(t.push("gone"), {
      name: "gone",
      stage: "Logic",
    });
    s.update.add(t.push("kept"), { name: "kept", stage: "Logic" });

    handle.remove();
    s.runLane("update", CTX);

    expect(t.log).toEqual(["kept"]);
  });

  it("setEnabled(false) skips a step without removing it", () => {
    const s = new Scheduler();
    const t = trace();

    const handle = s.update.add(t.push("toggle"), {
      name: "toggle",
      stage: "Logic",
    });

    handle.setEnabled(false);
    s.runLane("update", CTX);
    expect(t.log).toEqual([]);

    handle.setEnabled(true);
    s.runLane("update", CTX);
    expect(t.log).toEqual(["toggle"]);
  });
});

describe("Scheduler — sets", () => {
  it("disable()/enable() toggle every member step", () => {
    const s = new Scheduler();
    const t = trace();
    const set = s.createSet("editor");

    set.add("update", t.push("picking"), { name: "picking", stage: "Editor" });
    set.add("update", t.push("gizmo"), {
      name: "gizmo",
      stage: "Editor",
      after: "picking",
    });

    set.disable();
    s.runLane("update", CTX);
    expect(t.log).toEqual([]);

    set.enable();
    s.runLane("update", CTX);
    expect(t.log).toEqual(["picking", "gizmo"]);
  });

  it("remove() unregisters every member step", () => {
    const s = new Scheduler();
    const t = trace();
    const set = s.createSet("editor");

    set.add("update", t.push("picking"), { name: "picking", stage: "Editor" });
    set.remove();

    s.runLane("update", CTX);
    expect(t.log).toEqual([]);
  });
});
