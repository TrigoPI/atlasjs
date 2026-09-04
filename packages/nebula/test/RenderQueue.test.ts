import { describe, it, expect } from "vitest";

import { RenderQueue } from "../src/renderers/RenderQueue";
import { Batcher, KIND_ORDER } from "../src/renderers/NodeRenderer";
import { DrawCommand } from "../src/renderers/DrawCommand";

type Ev = string;

function recorder(tag: string, log: Ev[]): Batcher {
  return {
    begin: (c: DrawCommand): void => {
      log.push(`${tag}.begin:${c.batchKey}`);
    },
    add: (c: DrawCommand): void => {
      log.push(`${tag}.add:${c.batchKey}`);
    },
    draw: (): void => {
      log.push(`${tag}.draw`);
    },
  };
}

function cmd(kind: string, sortPrimary: number, batchKey: number): DrawCommand {
  return {
    kind,
    sortingLayer: 0,
    sortPrimary,
    sortSecondary: 0,
    kindOrder: (KIND_ORDER as Record<string, number>)[kind] ?? 0,
    batchKey,
  } as unknown as DrawCommand;
}

function full(
  kind: string,
  sortingLayer: number,
  sortPrimary: number,
  sortSecondary: number,
  batchKey: number,
): DrawCommand {
  return {
    kind,
    sortingLayer,
    sortPrimary,
    sortSecondary,
    kindOrder: (KIND_ORDER as Record<string, number>)[kind] ?? 0,
    batchKey,
  } as unknown as DrawCommand;
}

describe("RenderQueue registry dispatch", () => {
  it("groups contiguous same-kind/same-batchKey runs and dispatches by kind", () => {
    const log: Ev[] = [];
    const q: RenderQueue = new RenderQueue();
    q.register("sprite", recorder("sprite", log));
    q.register("shape", recorder("shape", log));

    q.submit(cmd("sprite", 1, 7));
    q.submit(cmd("sprite", 2, 7));
    q.submit(cmd("shape", 3, 0));
    q.submit(cmd("sprite", 4, 9));
    q.sort();
    q.flush({} as never);

    expect(log).toEqual([
      "sprite.begin:7",
      "sprite.add:7",
      "sprite.add:7",
      "sprite.draw",
      "shape.begin:0",
      "shape.add:0",
      "shape.draw",
      "sprite.begin:9",
      "sprite.add:9",
      "sprite.draw",
    ]);
  });

  it("skips commands of an unregistered kind without invoking a batcher and without hanging", () => {
    const log: Ev[] = [];
    const q: RenderQueue = new RenderQueue();
    q.register("sprite", recorder("sprite", log));

    q.submit(cmd("unknown", 1, 0));
    q.submit(cmd("sprite", 2, 5));
    q.sort();
    q.flush({} as never);

    expect(log).toEqual(["sprite.begin:5", "sprite.add:5", "sprite.draw"]);
  });

  it("orders by sortingLayer before the within-layer value", () => {
    const log: Ev[] = [];
    const q: RenderQueue = new RenderQueue();
    q.register("sprite", recorder("sprite", log));

    q.submit(full("sprite", 1, 0, 0, 11));
    q.submit(full("sprite", 0, 999, 0, 22));
    q.sort();
    q.flush({} as never);

    expect(log).toEqual([
      "sprite.begin:22",
      "sprite.add:22",
      "sprite.draw",
      "sprite.begin:11",
      "sprite.add:11",
      "sprite.draw",
    ]);
  });

  it("breaks ties within a layer by sortSecondary", () => {
    const log: Ev[] = [];
    const q: RenderQueue = new RenderQueue();
    q.register("sprite", recorder("sprite", log));

    q.submit(full("sprite", 0, 42, 5, 33));
    q.submit(full("sprite", 0, 42, 1, 44));
    q.sort();
    q.flush({} as never);

    expect(log).toEqual([
      "sprite.begin:44",
      "sprite.add:44",
      "sprite.draw",
      "sprite.begin:33",
      "sprite.add:33",
      "sprite.draw",
    ]);
  });
});
