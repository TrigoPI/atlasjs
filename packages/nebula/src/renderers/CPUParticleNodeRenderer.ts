import { Bound, Mat4, Vec4 } from "@atlasjs/math";
import { CPUParticleNode, Node } from "../graphics";
import { ParticleDrawCommand } from "./DrawCommand";
import { NodeRendererBase } from "./NodeRendererBase";
import { NodeRenderer, Batcher, KIND_ORDER } from "./NodeRenderer";
import { ParticleBatcher } from "./Batchers";
import { Renderer, Sampler } from "../core";

type ParticleRenderData = {
  models: Mat4[];
  uvRects: Vec4[];
  tints: Vec4[];
};

const HALF_DIAGONAL: number = Math.SQRT1_2;
const VELOCITY_EPSILON_SQ: number = 1e-12;

export class CPUParticleNodeRenderer
  extends NodeRendererBase<CPUParticleNode, ParticleRenderData>
  implements NodeRenderer
{
  public readonly kind = "particle" as const;

  private readonly defaultSampler: Sampler;
  private readonly worldBase: Mat4;
  private readonly batchIds: Map<string, number>;

  private nextBatchId: number;

  public constructor(renderer: Renderer) {
    super();

    this.batchIds = new Map();
    this.nextBatchId = 0;
    this.worldBase = Mat4.identity();

    this.defaultSampler = renderer.createSampler({
      minFilter: "nearest",
      magFilter: "nearest",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });
  }

  public matches(node: Node): boolean {
    return node instanceof CPUParticleNode;
  }

  public collect(
    node: Node,
    viewport: Bound,
    scratch: Bound,
  ): ParticleDrawCommand | null {
    const particles: CPUParticleNode = node as CPUParticleNode;
    const count: number = particles.aliveCount;

    if (particles.texture === null || count === 0) {
      return null;
    }

    if (!viewport.overlaps(this.computeBound(particles, count, scratch))) {
      return null;
    }

    const sampler: Sampler = particles.sampler ?? this.defaultSampler;
    const materialKey: string = `${particles.texture.id}|${sampler.id}|${particles.blend}`;
    const batchId: number = this.getBatchId(materialKey);

    const data: ParticleRenderData = this.getOrCreateRenderData(particles);
    this.updateInstances(particles, data, count);

    return {
      kind: "particle",
      sortingLayer: particles.sortingLayer,
      sortPrimary: particles.sortPrimary,
      sortSecondary: particles.sortSecondary,
      kindOrder: KIND_ORDER.particle,
      batchKey: batchId,
      renderState: NodeRendererBase.RENDER_STATES[particles.blend],
      texture: particles.texture,
      sampler,
      models: data.models,
      uvRects: data.uvRects,
      tints: data.tints,
      count,
    };
  }

  public createBatcher(renderer: Renderer): Batcher {
    return new ParticleBatcher(renderer.createSpriteBatch());
  }

  protected createRenderData(): ParticleRenderData {
    return { models: [], uvRects: [], tints: [] };
  }

  private computeBound(
    node: CPUParticleNode,
    count: number,
    out: Bound,
  ): Bound {
    let minX: number = Infinity;
    let minY: number = Infinity;
    let maxX: number = -Infinity;
    let maxY: number = -Infinity;
    let maxSize: number = 0;

    for (let i: number = 0; i < count; i++) {
      const x: number = node.getX(i);
      const y: number = node.getY(i);
      const size: number = node.getSize(i);

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxSize = Math.max(maxSize, size);
    }

    const margin: number = maxSize * HALF_DIAGONAL;
    const x0: number = minX - margin;
    const y0: number = minY - margin;
    const x1: number = maxX + margin;
    const y1: number = maxY + margin;

    if (node.simulationSpace === "local") {
      return this.transformBound(node.worldMatrix, x0, y0, x1, y1, out);
    }

    return out.set(x0, y0, x1 - x0, y1 - y0);
  }

  private transformBound(
    matrix: Mat4,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    out: Bound,
  ): Bound {
    const m: Float32Array = matrix.buffer;
    const m0: number = m[0];
    const m1: number = m[1];
    const m4: number = m[4];
    const m5: number = m[5];
    const m12: number = m[12];
    const m13: number = m[13];

    const px0: number = m0 * x0 + m4 * y0 + m12;
    const py0: number = m1 * x0 + m5 * y0 + m13;
    const px1: number = m0 * x1 + m4 * y0 + m12;
    const py1: number = m1 * x1 + m5 * y0 + m13;
    const px2: number = m0 * x0 + m4 * y1 + m12;
    const py2: number = m1 * x0 + m5 * y1 + m13;
    const px3: number = m0 * x1 + m4 * y1 + m12;
    const py3: number = m1 * x1 + m5 * y1 + m13;

    const minX: number = Math.min(px0, px1, px2, px3);
    const minY: number = Math.min(py0, py1, py2, py3);
    const maxX: number = Math.max(px0, px1, px2, px3);
    const maxY: number = Math.max(py0, py1, py2, py3);

    return out.set(minX, minY, maxX - minX, maxY - minY);
  }

  private updateInstances(
    node: CPUParticleNode,
    data: ParticleRenderData,
    count: number,
  ): void {
    const base: Mat4 =
      node.simulationSpace === "local" ? node.worldMatrix : this.worldBase;
    const aligned: boolean = node.alignment === "velocity";

    for (let i: number = 0; i < count; i++) {
      let model: Mat4 | undefined = data.models[i];
      if (model === undefined) {
        model = Mat4.identity();
        data.models[i] = model;
      }

      let uvRect: Vec4 | undefined = data.uvRects[i];
      if (uvRect === undefined) {
        uvRect = new Vec4(0, 0, 1, 1);
        data.uvRects[i] = uvRect;
      }

      let tint: Vec4 | undefined = data.tints[i];
      if (tint === undefined) {
        tint = new Vec4(1, 1, 1, 1);
        data.tints[i] = tint;
      }

      const size: number = node.getSize(i);
      const rotation: number = aligned
        ? this.velocityRotation(node, i)
        : node.getRotation(i);

      model
        .copy(base)
        .translate(node.getX(i), node.getY(i), 0)
        .rotateZ(rotation)
        .scale(size, size);

      node.getColor(i, tint);
    }
  }

  private velocityRotation(node: CPUParticleNode, index: number): number {
    const vx: number = node.getVelocityX(index);
    const vy: number = node.getVelocityY(index);

    if (!(vx * vx + vy * vy > VELOCITY_EPSILON_SQ)) {
      return node.getRotation(index);
    }

    return Math.atan2(vy, vx) + node.getRotation(index);
  }

  private getBatchId(key: string): number {
    const BATCH_MAX: number = 65535;
    let id: number | undefined = this.batchIds.get(key);

    if (id === undefined) {
      id = Math.min(this.nextBatchId, BATCH_MAX);
      this.nextBatchId++;
      this.batchIds.set(key, id);
    }

    return id;
  }
}
