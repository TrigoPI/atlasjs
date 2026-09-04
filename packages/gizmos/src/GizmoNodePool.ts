import { CircleNode, LineNode, RectNode } from "@atlasjs/nebula";
import type { NebulaRenderer } from "@atlasjs/nebula";

import { NodeRing } from "./NodeRing";

export class GizmoNodePool {
  private readonly rects: NodeRing<RectNode>;
  private readonly circles: NodeRing<CircleNode>;
  private readonly lines: NodeRing<LineNode>;

  public constructor(nebula: NebulaRenderer) {
    this.rects = new NodeRing<RectNode>(nebula, () => new RectNode());
    this.circles = new NodeRing<CircleNode>(nebula, () => new CircleNode());
    this.lines = new NodeRing<LineNode>(nebula, () => new LineNode());
  }

  public acquireRect(): RectNode {
    return this.rects.acquire();
  }

  public acquireCircle(): CircleNode {
    return this.circles.acquire();
  }

  public acquireLine(): LineNode {
    return this.lines.acquire();
  }

  public hideUnused(): void {
    this.rects.hideUnused();
    this.circles.hideUnused();
    this.lines.hideUnused();
  }

  public reset(): void {
    this.rects.reset();
    this.circles.reset();
    this.lines.reset();
  }

  public dispose(): void {
    this.rects.dispose();
    this.circles.dispose();
    this.lines.dispose();
  }
}
