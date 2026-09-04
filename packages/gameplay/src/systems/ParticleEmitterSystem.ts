import { Vec2, Vec4 } from "@atlasjs/math";
import type { Bound } from "@atlasjs/math";

import { ParticleEmitter, WorldTransform2D } from "../components";
import { applySortFields } from "../rendering/applySortFields";
import { DetachedPool } from "../rendering/DetachedPool";
import type { SortingLayers } from "../rendering";
import type { TimeScaleManager } from "../time";

import { CPUParticleNode, NebulaRenderer } from "@atlasjs/nebula";
import type {
  ParticleEmitterConfig,
  ParticleState,
  Sprite,
  Texture2D,
} from "@atlasjs/nebula";

import {
  Entity,
  NexusSystem,
  NexusSystemContext,
  SparseSet,
} from "@atlasjs/nexus";

const NO_RECTS: ReadonlyArray<Vec4> = [];

interface MountedEmitter {
  node: CPUParticleNode;
  config: ParticleEmitterConfig;
  frames: ReadonlyArray<Sprite>;
  state: ParticleState;
}

export class ParticleEmitterSystem implements NexusSystem {
  private readonly mounted: SparseSet<MountedEmitter>;
  private readonly detached: DetachedPool<CPUParticleNode>;
  private readonly nebula: NebulaRenderer;
  private readonly sortingLayers: SortingLayers;
  private readonly timeScale: TimeScaleManager | undefined;
  private readonly positionScratch: Vec2;
  private readonly scaleScratch: Vec2;

  public constructor(
    nebula: NebulaRenderer,
    sortingLayers: SortingLayers,
    timeScale?: TimeScaleManager,
  ) {
    this.mounted = new SparseSet<MountedEmitter>();
    this.detached = new DetachedPool<CPUParticleNode>({
      advance: (node: CPUParticleNode, dt: number): void => {
        node.advance(dt);
      },
      isExpired: (node: CPUParticleNode): boolean => node.aliveCount === 0,
      release: (node: CPUParticleNode): void => {
        node.removeFromParent();
      },
    });
    this.nebula = nebula;
    this.sortingLayers = sortingLayers;
    this.timeScale = timeScale;
    this.positionScratch = new Vec2();
    this.scaleScratch = new Vec2();
  }

  // prettier-ignore
  public update({ world, dt }: NexusSystemContext): void {
    world.query(WorldTransform2D, ParticleEmitter).each((entity: Entity, worldTransform: WorldTransform2D, emitter: ParticleEmitter) => {
      const mounted: MountedEmitter = this.resolveMounted(entity, emitter);
      const node: CPUParticleNode = mounted.node;

      if (emitter.config !== mounted.config) {
        mounted.config = emitter.config;
        node.applyConfig(emitter.config);
      }

      if (emitter.frames !== mounted.frames) {
        mounted.frames = emitter.frames;
        this.applyFrames(node, emitter.frames);
      }

      node.blend = emitter.blend;
      node.visible = emitter.visible;

      const position: Vec2 = worldTransform.getPosition(this.positionScratch);
      const scale: Vec2 = worldTransform.getScale(this.scaleScratch);

      node
        .setPosition(position.x, position.y)
        .setRotation(worldTransform.getRotation())
        .setScale(scale.x, scale.y);

      node.updateWorldMatrix();

      this.drain(node, emitter, mounted);

      node.advance(dt * this.scaleFor(entity));

      applySortFields(
        node,
        this.sortingLayers,
        emitter.sortingLayer,
        emitter.sortingOrder,
        position.y,
      );
    });

    this.detached.advance(dt);
  }

  public detach(entity: Entity): void {
    const mounted: MountedEmitter | undefined = this.mounted.get(entity);

    if (mounted === undefined) {
      return;
    }

    this.mounted.delete(entity);
    mounted.node.stop();
    this.detached.push(mounted.node);
  }

  public clear(): void {
    this.detached.clear();
  }

  private scaleFor(entity: Entity): number {
    return this.timeScale === undefined ? 1 : this.timeScale.scaleOf(entity);
  }

  private resolveMounted(
    entity: Entity,
    emitter: ParticleEmitter,
  ): MountedEmitter {
    const existing: MountedEmitter | undefined = this.mounted.get(entity);

    if (existing !== undefined) {
      return existing;
    }

    const node: CPUParticleNode = new CPUParticleNode(emitter.config);
    this.nebula.scene.addChild(node);

    this.applyFrames(node, emitter.frames);

    const mounted: MountedEmitter = {
      node,
      config: emitter.config,
      frames: emitter.frames,
      state: node.state,
    };
    this.mounted.set(entity, mounted);

    return mounted;
  }

  private drain(
    node: CPUParticleNode,
    emitter: ParticleEmitter,
    mounted: MountedEmitter,
  ): void {
    if (emitter.command === "restart") {
      emitter.command = "none";
      node.play();
      mounted.state = "playing";
    } else if (emitter.command === "clear") {
      emitter.command = "none";
      node.clear();
    }

    if (emitter.state !== mounted.state) {
      mounted.state = emitter.state;
      this.applyState(node, emitter.state);
    }

    const pending: number = emitter.pendingEmit;
    const whole: number = pending > 0 ? Math.floor(pending) : 0;

    if (whole > 0) {
      node.emit(whole);
      emitter.pendingEmit = pending - whole;
    }
  }

  private applyState(node: CPUParticleNode, state: ParticleState): void {
    if (state === "playing") {
      node.play();
      return;
    }

    if (state === "paused") {
      node.pause();
      return;
    }

    node.stop();
  }

  private applyFrames(
    node: CPUParticleNode,
    frames: ReadonlyArray<Sprite>,
  ): void {
    if (frames.length === 0) {
      node.setFrameRects(NO_RECTS);
      node.texture = null;
      return;
    }

    const texture: Texture2D = frames[0].texture;
    const rects: Vec4[] = [];

    for (let i: number = 0; i < frames.length; i++) {
      const sprite: Sprite = frames[i];

      if (sprite.texture !== texture) {
        throw new Error(
          `ParticleEmitter.frames must all share a single Texture2D: frame 0 uses '${texture.id}' but frame ${i} uses '${sprite.texture.id}'. A CPUParticleNode holds one texture, so pack every particle frame into the same atlas.`,
        );
      }

      const rect: Bound = sprite.rect;

      rects.push(
        new Vec4(
          rect.x / texture.width,
          rect.y / texture.height,
          rect.width / texture.width,
          rect.height / texture.height,
        ),
      );
    }

    node.setFrameRects(rects);
    node.texture = texture;
  }
}
