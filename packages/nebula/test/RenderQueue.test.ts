import { describe, it, expect } from "vitest";

import { RenderQueue } from "../src/renderers/RenderQueue";
import { Batcher } from "../src/renderers/NodeRenderer";
import { DrawCommand } from "../src/renderers/DrawCommand";

type Ev = string;

function recorder(tag: string, log: Ev[]): Batcher {
  return {
    begin: (c: DrawCommand): void => log.push(`${tag}.begin:${c.batchKey}`),
    add: (c: DrawCommand): void => log.push(`${tag}.add:${c.batchKey}`),
    draw: (): void => log.push(`${tag}.draw`),
  };
}

function cmd(kind: string, sortKey: number, batchKey: number): DrawCommand {
  return { kind, sortKey, batchKey } as unknown as DrawCommand;
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
});
