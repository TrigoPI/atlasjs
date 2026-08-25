import { createLogger, Logger } from "@atlasjs/utils";
import {
  Engine,
  Plugin,
  Scheduler,
  StepContext,
  StepHandle,
} from "@atlasjs/core";
import { NEBULA_RENDERER, NebulaRenderer } from "@atlasjs/nebula";
import { INERTIAL_ENGINE, PhysicsWorld } from "@atlasjs/inertia";
import { Entity, NEXUS, NexusWorld, Unsubscribe } from "@atlasjs/nexus";
import { ASSET_MANAGER, AssetManager } from "@atlasjs/assets";

import { SCRIPT_MANAGER, INSTANTIATOR } from "./tokens";
import { CameraManager, CAMERA_MANAGER } from "./camera";
import { registerSystem } from "./registerSystem";
import { SpriteLoader, TileSetLoader } from "./assets";
import { SortingLayers, SORTING_LAYERS } from "./rendering";

import { ScriptManager } from "./scripting";
import { Instantiator } from "./prefab";
import { OccluderRenderSystem } from "./systems/OccluderRenderSystem";

import {
  AfterimageRenderSystem,
  AnimatorSystem,
  AudioSystem,
  CameraSyncSystem,
  PhysicsCollisionSystem,
  PhysicsPullSystem,
  PhysicsPushSystem,
  PlayerInputSystem,
  SpriteRenderSystem,
  TileMapRenderSystem,
  TrailRenderSystem,
  TransformPropagationSystem,
} from "./systems";

import {
  AfterimageRenderer,
  Animator,
  AudioSource,
  Camera,
  CharacterController2D,
  CharacterControllerRef,
  Collider2D,
  Grid,
  PhysicsBodyRef,
  PhysicsColliderRef,
  PlayerInput,
  RigidBody2D,
  SpriteRender,
  TileMap,
  TileMapRenderer,
  TrailRenderer,
  Transform2D,
  WorldTransform2D,
} from "./components";
import { OccluderStrip } from "./components/OccluderStrip";

export class GameplayPlugin extends Plugin {
  private readonly logger: Logger;

  private scriptManager!: ScriptManager;
  private trailRenderSystem?: TrailRenderSystem;
  private afterimageRenderSystem?: AfterimageRenderSystem;
  private handles: StepHandle[];
  private unsubscribers: Unsubscribe[];

  public constructor() {
    super("gameplay-plugin", {
      requires: [NEXUS, NEBULA_RENDERER, INERTIAL_ENGINE, ASSET_MANAGER],
      provides: [SCRIPT_MANAGER, INSTANTIATOR, CAMERA_MANAGER, SORTING_LAYERS],
    });
    this.logger = createLogger(GameplayPlugin.name);
    this.handles = [];
    this.unsubscribers = [];
  }

  // prettier-ignore
  public async install(engine: Engine): Promise<void> {
    const world: NexusWorld = await engine.services.wait(NEXUS);
    const nebula: NebulaRenderer = await engine.services.wait(NEBULA_RENDERER);
    const inertia: PhysicsWorld = await engine.services.wait(INERTIAL_ENGINE);
    const assets: AssetManager = await engine.services.wait(ASSET_MANAGER);

    assets.register(new SpriteLoader());
    assets.register(new TileSetLoader());

    this.scriptManager = new ScriptManager(world, engine.services);
    const instantiator: Instantiator = new Instantiator(world, this.scriptManager);

    const physicsPushSystem: PhysicsPushSystem = new PhysicsPushSystem(inertia);
    const physicsPullSystem: PhysicsPullSystem = new PhysicsPullSystem();
    const physicsCollisionSystem: PhysicsCollisionSystem = new PhysicsCollisionSystem(inertia, this.scriptManager);
    const sortingLayers: SortingLayers = new SortingLayers();
    const spriteRenderSystem: SpriteRenderSystem = new SpriteRenderSystem(nebula, sortingLayers);
    const tileMapRenderSystem: TileMapRenderSystem = new TileMapRenderSystem(nebula, sortingLayers);
    const occluderRenderSystem: OccluderRenderSystem = new OccluderRenderSystem(nebula, sortingLayers);
    const trailRenderSystem: TrailRenderSystem = new TrailRenderSystem(nebula, sortingLayers);
    this.trailRenderSystem = trailRenderSystem;
    const afterimageRenderSystem: AfterimageRenderSystem = new AfterimageRenderSystem(nebula, sortingLayers);
    this.afterimageRenderSystem = afterimageRenderSystem;
    const playerInputSystem: PlayerInputSystem = new PlayerInputSystem(engine.services);
    const animatorSystem: AnimatorSystem = new AnimatorSystem();
    const audioSystem: AudioSystem = new AudioSystem(engine.services);
    const cameraManager: CameraManager = new CameraManager(nebula);
    const transformPropagationSystem: TransformPropagationSystem = new TransformPropagationSystem();
    const cameraSyncSystem: CameraSyncSystem = new CameraSyncSystem(cameraManager, nebula);

    this.defineComponents(world);

    this.registerCleanup(world, inertia, spriteRenderSystem, tileMapRenderSystem, occluderRenderSystem, cameraManager, trailRenderSystem, afterimageRenderSystem);

    this.unsubscribers.push(
      world.onAdd(AudioSource, (_entity: Entity, source: AudioSource) => {
        if (source.playOnAwake) {
          source.play();
        }
      }),
      world.onRemove(AudioSource, (_entity: Entity, source: AudioSource) => {
        audioSystem.release(source);
      }),
    );

    this.registerSteps(
      engine.scheduler,
      world,
      playerInputSystem,
      animatorSystem,
      audioSystem,
      transformPropagationSystem,
      physicsPushSystem,
      physicsPullSystem,
      physicsCollisionSystem,
      cameraSyncSystem,
      spriteRenderSystem,
      tileMapRenderSystem,
      occluderRenderSystem,
      trailRenderSystem,
      afterimageRenderSystem,
    );

    this.logger.log("GameplayPlugin installed.");
    engine.services.provide(SCRIPT_MANAGER, this.scriptManager);
    engine.services.provide(INSTANTIATOR, instantiator);
    engine.services.provide(CAMERA_MANAGER, cameraManager);
    engine.services.provide(SORTING_LAYERS, sortingLayers);

    this.deferred.resolve();
  }

  private defineComponents(world: NexusWorld): void {
    world
      .defineComponent(RigidBody2D)
      .defineComponent(Transform2D)
      .defineComponent(WorldTransform2D)
      .defineComponent(SpriteRender)
      .defineComponent(PhysicsBodyRef)
      .defineComponent(Collider2D)
      .defineComponent(PhysicsColliderRef)
      .defineComponent(CharacterController2D)
      .defineComponent(CharacterControllerRef)
      .defineComponent(PlayerInput)
      .defineComponent(Animator)
      .defineComponent(AudioSource)
      .defineComponent(Camera)
      .defineComponent(Grid)
      .defineComponent(TileMap)
      .defineComponent(TileMapRenderer)
      .defineComponent(TrailRenderer)
      .defineComponent(AfterimageRenderer)
      .defineComponent(OccluderStrip);
  }

  // prettier-ignore
  private registerCleanup(
    world: NexusWorld,
    inertia: PhysicsWorld,
    spriteRenderSystem: SpriteRenderSystem,
    tileMapRenderSystem: TileMapRenderSystem,
    occluderRenderSystem: OccluderRenderSystem,
    cameraManager: CameraManager,
    trailRenderSystem: TrailRenderSystem,
    afterimageRenderSystem: AfterimageRenderSystem,
  ): void {
    this.unsubscribers.push(
      world.onRemove(PhysicsBodyRef, (_entity: Entity, ref: PhysicsBodyRef) => {
        inertia.destroyRigidBody(ref.body);
      }),

      world.onRemove(RigidBody2D, (entity: Entity) => {
        if (world.hasComponent(entity, PhysicsColliderRef)) {
          world.removeComponent(entity, PhysicsColliderRef);
        }

        if (world.hasComponent(entity, PhysicsBodyRef)) {
          world.removeComponent(entity, PhysicsBodyRef);
        }
      }),

      world.onRemove(PhysicsColliderRef, (_entity: Entity, ref: PhysicsColliderRef) => {
        inertia.destroyCollider(ref.collider);
      }),

      world.onRemove(Collider2D, (entity: Entity) => {
        if (world.hasComponent(entity, PhysicsColliderRef)) {
          world.removeComponent(entity, PhysicsColliderRef);
        }
      }),

      world.onRemove(CharacterControllerRef, (_entity: Entity, ref: CharacterControllerRef) => {
        inertia.destroyCharacterController(ref.controller);
      }),

      world.onRemove(CharacterController2D, (entity: Entity) => {
        if (world.hasComponent(entity, CharacterControllerRef)) {
          world.removeComponent(entity, CharacterControllerRef);
        }
      }),

      world.onRemove(SpriteRender, (entity: Entity) => {
        spriteRenderSystem.unmount(entity);
      }),

      world.onRemove(SpriteRender, (entity: Entity) => {
        afterimageRenderSystem.detach(entity);
      }),

      world.onRemove(TileMap, (entity: Entity) => {
        tileMapRenderSystem.unmount(entity);
      }),

      world.onRemove(OccluderStrip, (entity: Entity) => {
        occluderRenderSystem.unmount(entity);
      }),

      world.onRemove(TrailRenderer, (entity: Entity) => {
        trailRenderSystem.detach(entity);
      }),

      world.onRemove(AfterimageRenderer, (entity: Entity) => {
        afterimageRenderSystem.detach(entity);
      }),

      world.onRemove(Transform2D, (entity: Entity) => {
        if (world.hasComponent(entity, WorldTransform2D)) {
          world.removeComponent(entity, WorldTransform2D);
        }
      }),

      world.onRemove(Camera, (entity: Entity) => {
        if (cameraManager.getActive() === entity) {
          cameraManager.setActive(undefined);
        }
      }),
    );
  }

  private registerSteps(
    scheduler: Scheduler,
    world: NexusWorld,
    playerInputSystem: PlayerInputSystem,
    animatorSystem: AnimatorSystem,
    audioSystem: AudioSystem,
    transformPropagationSystem: TransformPropagationSystem,
    physicsPushSystem: PhysicsPushSystem,
    physicsPullSystem: PhysicsPullSystem,
    physicsCollisionSystem: PhysicsCollisionSystem,
    cameraSyncSystem: CameraSyncSystem,
    spriteRenderSystem: SpriteRenderSystem,
    tileMapRenderSystem: TileMapRenderSystem,
    occluderRenderSystem: OccluderRenderSystem,
    trailRenderSystem: TrailRenderSystem,
    afterimageRenderSystem: AfterimageRenderSystem,
  ): void {
    const { fixed, update, render } = scheduler;

    this.handles.push(
      fixed.add(() => this.scriptManager.fixedUpdate(), {
        name: "gameplay:script-fixed",
        stage: "ScriptFixed",
      }),
    );

    this.handles.push(
      registerSystem(update, world, playerInputSystem, {
        name: "gameplay:player-input",
        stage: "Early",
      }),
    );

    this.handles.push(
      update.add((ctx: StepContext) => this.scriptManager.update(ctx.dt), {
        name: "gameplay:script-update",
        stage: "Logic",
      }),
    );

    this.handles.push(
      registerSystem(update, world, animatorSystem, {
        name: "gameplay:animator",
        stage: "Logic",
        after: "gameplay:script-update",
      }),
    );

    this.handles.push(
      registerSystem(update, world, audioSystem, {
        name: "gameplay:audio",
        stage: "Late",
      }),
    );

    this.handles.push(
      registerSystem(update, world, transformPropagationSystem, {
        name: "gameplay:transform-propagation",
        stage: "Late",
      }),
    );

    this.handles.push(
      registerSystem(fixed, world, physicsPushSystem, {
        name: "gameplay:physics-push",
        stage: "PhysicsRequest",
      }),
      registerSystem(fixed, world, physicsPullSystem, {
        name: "gameplay:physics-pull",
        stage: "PhysicsWriteback",
      }),
      registerSystem(fixed, world, physicsCollisionSystem, {
        name: "gameplay:physics-collision",
        stage: "PhysicsWriteback",
        after: "gameplay:physics-pull",
      }),
    );

    this.handles.push(
      registerSystem(render, world, cameraSyncSystem, {
        name: "gameplay:camera-sync",
        stage: "PreRender",
        before: "gameplay:sprite-render",
      }),
    );

    this.handles.push(
      registerSystem(render, world, spriteRenderSystem, {
        name: "gameplay:sprite-render",
        stage: "PreRender",
      }),
    );

    this.handles.push(
      registerSystem(render, world, tileMapRenderSystem, {
        name: "gameplay:tilemap-render",
        stage: "PreRender",
        after: "gameplay:sprite-render",
      }),
    );

    this.handles.push(
      registerSystem(render, world, occluderRenderSystem, {
        name: "gameplay:occluder-render",
        stage: "PreRender",
        after: "gameplay:tilemap-render",
      }),
    );

    this.handles.push(
      registerSystem(render, world, trailRenderSystem, {
        name: "gameplay:trail-render",
        stage: "PreRender",
        after: "gameplay:occluder-render",
      }),
    );

    this.handles.push(
      registerSystem(render, world, afterimageRenderSystem, {
        name: "gameplay:afterimage-render",
        stage: "PreRender",
        after: "gameplay:trail-render",
      }),
    );
  }

  public uninstall(): void {
    this.logger.log("Uninstalling GameplayPlugin.");
    for (const handle of this.handles) handle.remove();
    for (const off of this.unsubscribers) off();
    this.trailRenderSystem?.clear();
    this.afterimageRenderSystem?.clear();
    this.scriptManager.dispose();
    this.handles = [];
    this.unsubscribers = [];
  }
}
