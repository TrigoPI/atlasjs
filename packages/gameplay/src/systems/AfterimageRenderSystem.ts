import { Vec2 } from "@atlasjs/math";

import { Sprite } from "@atlasjs/nebula";
import {
  AfterimageRenderer,
  SpriteRender,
  WorldTransform2D,
} from "../components";
import { applySortFields } from "../rendering/applySortFields";
import { DetachedPool } from "../rendering/DetachedPool";
import {
  AfterimageRing,
  resolveAfterimageCapacity,
} from "../rendering/AfterimageRing";
import type { AfterimageSlot } from "../rendering/AfterimageRing";
import type { SortingLayers } from "../rendering";

import { Color, NebulaRenderer, Sampler, SpriteNode } from "@atlasjs/nebula";

import {
  Entity,
  NexusSystem,
  NexusSystemContext,
  SparseSet,
} from "@atlasjs/nexus";

interface MountedAfterimages {
  ring: AfterimageRing;
  nodes: (SpriteNode | null)[];
  sinceLastStamp: number;
  lastStampX: number;
  lastStampY: number;
  hasLastStamp: boolean;
  stampDue: boolean;
  emitting: boolean;
  time: number;
  startColor: Color;
  endColor: Color;
  visible: boolean;
  sortingLayer: string;
  sortingOrder: number;
}

export class AfterimageRenderSystem implements NexusSystem {
  private readonly mounted: SparseSet<MountedAfterimages>;
  private readonly detached: DetachedPool<MountedAfterimages>;
  private readonly nebula: NebulaRenderer;
  private readonly sortingLayers: SortingLayers;
  private readonly sampler: Sampler;
  private readonly positionScratch: Vec2;
  private readonly scaleScratch: Vec2;

  public constructor(nebula: NebulaRenderer, sortingLayers: SortingLayers) {
    this.mounted = new SparseSet<MountedAfterimages>();
    this.detached = new DetachedPool<MountedAfterimages>({
      advance: (mounted: MountedAfterimages, dt: number): void => {
        mounted.ring.advance(dt, mounted.time);
        this.render(mounted);
      },
      isExpired: (mounted: MountedAfterimages): boolean =>
        mounted.ring.size === 0,
      release: (mounted: MountedAfterimages): void => {
        this.release(mounted);
      },
    });
    this.nebula = nebula;
    this.sortingLayers = sortingLayers;
    this.positionScratch = new Vec2();
    this.scaleScratch = new Vec2();
    this.sampler = nebula.createSampler({
      magFilter: "nearest",
      minFilter: "nearest",
    });
  }

  // prettier-ignore
  public update({ world, dt }: NexusSystemContext): void {
    world.query(WorldTransform2D, SpriteRender, AfterimageRenderer).each((entity: Entity, worldTransform: WorldTransform2D, spriteRender: SpriteRender, renderer: AfterimageRenderer) => {
      const mounted: MountedAfterimages = this.resolveMounted(entity, renderer);

      this.sync(mounted, renderer);

      const wasEmitting: boolean = mounted.emitting;
      mounted.emitting = renderer.emitting;

      if (renderer.emitting && !wasEmitting) {
        this.empty(mounted);
      }

      if (renderer.command === "clear") {
        this.empty(mounted);
        renderer.command = "none";
      }

      if (renderer.emitting) {
        this.stamp(mounted, renderer, worldTransform, spriteRender, dt);
      }

      mounted.ring.advance(dt, mounted.time);
      this.render(mounted);
    });

    this.detached.advance(dt);
  }

  public detach(entity: Entity): void {
    const mounted: MountedAfterimages | undefined = this.mounted.get(entity);

    if (mounted === undefined) {
      return;
    }

    this.mounted.delete(entity);
    this.detached.push(mounted);
  }

  public clear(): void {
    this.detached.clear();
  }

  private release(mounted: MountedAfterimages): void {
    for (let i: number = 0; i < mounted.nodes.length; i++) {
      const node: SpriteNode | null = mounted.nodes[i];

      if (node !== null) {
        node.removeFromParent();
        mounted.nodes[i] = null;
      }
    }
  }

  private sync(
    mounted: MountedAfterimages,
    renderer: AfterimageRenderer,
  ): void {
    const start: Color = renderer.startColor;
    const end: Color = renderer.endColor;

    mounted.time = renderer.time;
    mounted.startColor.set(start.r, start.g, start.b, start.a);
    mounted.endColor.set(end.r, end.g, end.b, end.a);
    mounted.visible = renderer.visible;
    mounted.sortingLayer = renderer.sortingLayer;
    mounted.sortingOrder = renderer.sortingOrder;

    this.resize(mounted, resolveAfterimageCapacity(renderer.maxImages));
  }

  private resize(mounted: MountedAfterimages, capacity: number): void {
    if (mounted.nodes.length === capacity) {
      return;
    }

    while (mounted.nodes.length > capacity) {
      const node: SpriteNode | null | undefined = mounted.nodes.pop();

      if (node !== null && node !== undefined) {
        node.removeFromParent();
      }
    }

    while (mounted.nodes.length < capacity) {
      mounted.nodes.push(null);
    }

    mounted.ring.resize(capacity);
    this.empty(mounted);
  }

  private empty(mounted: MountedAfterimages): void {
    mounted.ring.clear();
    mounted.hasLastStamp = false;
    mounted.stampDue = true;
  }

  private stamp(
    mounted: MountedAfterimages,
    renderer: AfterimageRenderer,
    worldTransform: WorldTransform2D,
    spriteRender: SpriteRender,
    dt: number,
  ): void {
    mounted.sinceLastStamp += dt;

    if (!mounted.stampDue && mounted.sinceLastStamp < renderer.interval) {
      return;
    }

    const position: Vec2 = worldTransform.getPosition(this.positionScratch);

    if (mounted.hasLastStamp) {
      const dx: number = position.x - mounted.lastStampX;
      const dy: number = position.y - mounted.lastStampY;
      const minDistance: number = renderer.minDistance;

      if (dx * dx + dy * dy < minDistance * minDistance) {
        return;
      }
    }

    const scale: Vec2 = worldTransform.getScale(this.scaleScratch);

    mounted.ring.stamp(
      spriteRender.sprite,
      position.x,
      position.y,
      worldTransform.getRotation(),
      scale.x * (spriteRender.flipX ? -1 : 1),
      scale.y * (spriteRender.flipY ? -1 : 1),
    );

    mounted.sinceLastStamp = 0;
    mounted.lastStampX = position.x;
    mounted.lastStampY = position.y;
    mounted.hasLastStamp = true;
    mounted.stampDue = false;
  }

  // prettier-ignore
  private render(mounted: MountedAfterimages): void {
    const ring: AfterimageRing = mounted.ring;
    const capacity: number = ring.capacity;
    const start: Color = mounted.startColor;
    const end: Color = mounted.endColor;
    const time: number = mounted.time;

    for (let i: number = 0; i < capacity; i++) {
      const slot: AfterimageSlot = ring.at(i);

      if (!ring.isAlive(i) || slot.sprite === null) {
        mounted.nodes[i]?.setVisible(false);
        continue;
      }

      const sprite: Sprite = slot.sprite;
      const node: SpriteNode = this.resolveNode(mounted, i, sprite);
      const t: number = slot.age / time;

      node
        .setPosition(slot.x, slot.y)
        .setRotation(slot.rotation)
        .setScale(slot.scaleX, slot.scaleY)
        .setVisible(mounted.visible);

      node.setTint(
        start.r + (end.r - start.r) * t,
        start.g + (end.g - start.g) * t,
        start.b + (end.b - start.b) * t,
        start.a + (end.a - start.a) * t,
      );

      node.setAnchor(sprite.pivot.x, sprite.pivot.y);
      node.setSourceRect(sprite.rect.x, sprite.rect.y, sprite.rect.width, sprite.rect.height);

      applySortFields(
        node,
        this.sortingLayers,
        mounted.sortingLayer,
        mounted.sortingOrder,
        slot.y,
      );
    }
  }

  private resolveNode(
    mounted: MountedAfterimages,
    index: number,
    sprite: Sprite,
  ): SpriteNode {
    const existing: SpriteNode | null = mounted.nodes[index];

    if (existing !== null && existing.texture === sprite.texture) {
      return existing;
    }

    if (existing !== null) {
      existing.removeFromParent();
    }

    const node: SpriteNode = new SpriteNode(sprite.texture, this.sampler);
    this.nebula.scene.addChild(node);
    mounted.nodes[index] = node;

    return node;
  }

  private resolveMounted(
    entity: Entity,
    renderer: AfterimageRenderer,
  ): MountedAfterimages {
    const existing: MountedAfterimages | undefined = this.mounted.get(entity);

    if (existing !== undefined) {
      return existing;
    }

    const capacity: number = resolveAfterimageCapacity(renderer.maxImages);
    const nodes: (SpriteNode | null)[] = [];

    for (let i: number = 0; i < capacity; i++) {
      nodes.push(null);
    }

    const mounted: MountedAfterimages = {
      ring: new AfterimageRing(capacity),
      nodes,
      sinceLastStamp: 0,
      lastStampX: 0,
      lastStampY: 0,
      hasLastStamp: false,
      stampDue: false,
      emitting: renderer.emitting,
      time: renderer.time,
      startColor: new Color(0, 0, 0, 0),
      endColor: new Color(1, 1, 1, 0),
      visible: renderer.visible,
      sortingLayer: renderer.sortingLayer,
      sortingOrder: renderer.sortingOrder,
    };
    this.mounted.set(entity, mounted);

    return mounted;
  }
}
