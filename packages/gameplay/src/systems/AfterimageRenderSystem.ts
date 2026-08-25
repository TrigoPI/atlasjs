import { Vec2 } from "@atlasjs/math";

import { Sprite } from "@atlasjs/nebula";
import {
  AfterimageRenderer,
  SpriteRender,
  WorldTransform2D,
} from "../components";
import { applySortFields } from "../rendering/applySortFields";
import type { SortingLayers } from "../rendering";

import { Color, NebulaRenderer, Sampler, SpriteNode } from "@atlasjs/nebula";

import {
  Entity,
  NexusSystem,
  NexusSystemContext,
  SparseSet,
} from "@atlasjs/nexus";

const MIN_IMAGES: number = 1;
const MAX_IMAGES: number = 64;

interface AfterimageSlot {
  sprite: Sprite | null;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  age: number;
}

interface MountedAfterimages {
  slots: AfterimageSlot[];
  nodes: (SpriteNode | null)[];
  count: number;
  head: number;
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
  private readonly detached: MountedAfterimages[];
  private readonly nebula: NebulaRenderer;
  private readonly sortingLayers: SortingLayers;
  private readonly sampler: Sampler;
  private readonly positionScratch: Vec2;
  private readonly scaleScratch: Vec2;

  public constructor(nebula: NebulaRenderer, sortingLayers: SortingLayers) {
    this.mounted = new SparseSet<MountedAfterimages>();
    this.detached = [];
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

      this.advance(mounted, dt);
      this.render(mounted);
    });

    this.advanceDetached(dt);
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
    for (let i: number = 0; i < this.detached.length; i++) {
      this.release(this.detached[i]);
    }

    this.detached.length = 0;
  }

  private advanceDetached(dt: number): void {
    for (let i: number = this.detached.length - 1; i >= 0; i--) {
      const mounted: MountedAfterimages = this.detached[i];

      this.advance(mounted, dt);
      this.render(mounted);

      if (mounted.count > 0) {
        continue;
      }

      this.release(mounted);
      this.detached[i] = this.detached[this.detached.length - 1];
      this.detached.pop();
    }
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

    this.resize(mounted, this.resolveCapacity(renderer.maxImages));
  }

  private resolveCapacity(maxImages: number): number {
    const truncated: number = Math.trunc(maxImages);

    if (Number.isNaN(truncated)) {
      return MIN_IMAGES;
    }

    return Math.min(MAX_IMAGES, Math.max(MIN_IMAGES, truncated));
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

      mounted.slots.pop();
    }

    while (mounted.nodes.length < capacity) {
      mounted.nodes.push(null);
      mounted.slots.push(this.createSlot());
    }

    this.empty(mounted);
  }

  private empty(mounted: MountedAfterimages): void {
    mounted.count = 0;
    mounted.head = 0;
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

    const capacity: number = mounted.slots.length;
    const scale: Vec2 = worldTransform.getScale(this.scaleScratch);
    const slot: AfterimageSlot = mounted.slots[mounted.head];

    slot.sprite = spriteRender.sprite;
    slot.x = position.x;
    slot.y = position.y;
    slot.rotation = worldTransform.getRotation();
    slot.scaleX = scale.x * (spriteRender.flipX ? -1 : 1);
    slot.scaleY = scale.y * (spriteRender.flipY ? -1 : 1);
    slot.age = 0;

    mounted.head = (mounted.head + 1) % capacity;

    if (mounted.count < capacity) {
      mounted.count++;
    }

    mounted.sinceLastStamp = 0;
    mounted.lastStampX = position.x;
    mounted.lastStampY = position.y;
    mounted.hasLastStamp = true;
    mounted.stampDue = false;
  }

  private advance(mounted: MountedAfterimages, dt: number): void {
    const capacity: number = mounted.slots.length;
    let tail: number = (mounted.head - mounted.count + capacity) % capacity;

    for (let i: number = 0; i < mounted.count; i++) {
      mounted.slots[(tail + i) % capacity].age += dt;
    }

    while (mounted.count > 0 && mounted.slots[tail].age >= mounted.time) {
      tail = (tail + 1) % capacity;
      mounted.count--;
    }
  }

  // prettier-ignore
  private render(mounted: MountedAfterimages): void {
    const capacity: number = mounted.slots.length;
    const tail: number = (mounted.head - mounted.count + capacity) % capacity;
    const start: Color = mounted.startColor;
    const end: Color = mounted.endColor;
    const time: number = mounted.time;

    for (let i: number = 0; i < capacity; i++) {
      const slot: AfterimageSlot = mounted.slots[i];
      const alive: boolean = (i - tail + capacity) % capacity < mounted.count;

      if (!alive || slot.sprite === null) {
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

    const capacity: number = this.resolveCapacity(renderer.maxImages);
    const slots: AfterimageSlot[] = [];
    const nodes: (SpriteNode | null)[] = [];

    for (let i: number = 0; i < capacity; i++) {
      slots.push(this.createSlot());
      nodes.push(null);
    }

    const mounted: MountedAfterimages = {
      slots,
      nodes,
      count: 0,
      head: 0,
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

  private createSlot(): AfterimageSlot {
    return {
      sprite: null,
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      age: 0,
    };
  }
}
