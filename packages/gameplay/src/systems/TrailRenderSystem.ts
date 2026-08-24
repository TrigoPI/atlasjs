import { Vec2 } from "@atlasjs/math";

import { TrailRenderer, WorldTransform2D } from "../components";
import { applySortFields } from "../rendering/applySortFields";
import type { SortingLayers } from "../rendering";

import { Color, NebulaRenderer, TrailNode } from "@atlasjs/nebula";

import {
  Entity,
  NexusSystem,
  NexusSystemContext,
  SparseSet,
} from "@atlasjs/nexus";

interface MountedTrail {
  node: TrailNode;
  emitting: boolean;
}

export class TrailRenderSystem implements NexusSystem {
  private readonly mounted: SparseSet<MountedTrail>;
  private readonly detached: TrailNode[];
  private readonly nebula: NebulaRenderer;
  private readonly sortingLayers: SortingLayers;
  private readonly positionScratch: Vec2;

  public constructor(nebula: NebulaRenderer, sortingLayers: SortingLayers) {
    this.mounted = new SparseSet<MountedTrail>();
    this.detached = [];
    this.nebula = nebula;
    this.sortingLayers = sortingLayers;
    this.positionScratch = new Vec2();
  }

  // prettier-ignore
  public update({ world, dt }: NexusSystemContext): void {
    world.query(WorldTransform2D, TrailRenderer).each((entity: Entity, worldTransform: WorldTransform2D, trailRenderer: TrailRenderer) => {
      const mounted: MountedTrail = this.resolveMounted(entity, trailRenderer);
      const node: TrailNode = mounted.node;
      const position: Vec2 = worldTransform.getPosition(this.positionScratch);

      this.sync(node, trailRenderer);

      const wasEmitting: boolean = mounted.emitting;
      mounted.emitting = trailRenderer.emitting;

      if (trailRenderer.emitting && !wasEmitting) {
        node.clear();
      }

      if (trailRenderer.command === "clear") {
        node.clear();
        trailRenderer.command = "none";
      }

      if (trailRenderer.emitting) {
        node.emit(position.x, position.y);
      }

      node.advance(dt);

      applySortFields(
        node,
        this.sortingLayers,
        trailRenderer.sortingLayer,
        trailRenderer.sortingOrder,
        position.y,
      );
    });

    this.advanceDetached(dt);
  }

  public detach(entity: Entity): void {
    const mounted: MountedTrail | undefined = this.mounted.get(entity);

    if (mounted === undefined) {
      return;
    }

    this.mounted.delete(entity);
    this.detached.push(mounted.node);
  }

  public clear(): void {
    for (let i: number = 0; i < this.detached.length; i++) {
      this.detached[i].removeFromParent();
    }

    this.detached.length = 0;
  }

  private advanceDetached(dt: number): void {
    for (let i: number = this.detached.length - 1; i >= 0; i--) {
      const node: TrailNode = this.detached[i];
      node.advance(dt);

      if (node.pointCount >= 2) {
        continue;
      }

      node.removeFromParent();
      this.detached[i] = this.detached[this.detached.length - 1];
      this.detached.pop();
    }
  }

  private sync(node: TrailNode, trailRenderer: TrailRenderer): void {
    const start: Color = trailRenderer.startColor;
    const end: Color = trailRenderer.endColor;

    node.time = trailRenderer.time;
    node.minVertexDistance = trailRenderer.minVertexDistance;
    node.smoothing = trailRenderer.smoothing;
    node.startWidth = trailRenderer.startWidth;
    node.endWidth = trailRenderer.endWidth;
    node.startColor.set(start.r, start.g, start.b, start.a);
    node.endColor.set(end.r, end.g, end.b, end.a);
    node.blend = trailRenderer.blend;
    node.visible = trailRenderer.visible;
    node.setCapacity(trailRenderer.maxPoints);
  }

  private resolveMounted(
    entity: Entity,
    trailRenderer: TrailRenderer,
  ): MountedTrail {
    const existing: MountedTrail | undefined = this.mounted.get(entity);

    if (existing !== undefined) {
      return existing;
    }

    const node: TrailNode = new TrailNode();
    this.nebula.scene.addChild(node);

    const mounted: MountedTrail = {
      node,
      emitting: trailRenderer.emitting,
    };
    this.mounted.set(entity, mounted);

    return mounted;
  }
}
