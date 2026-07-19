import { createLogger, Logger } from "@atlasjs/utils";
import { Engine, Plugin, StepContext, StepHandle } from "@atlasjs/core";
import { NEBULA_RENDERER, NebulaRenderer } from "@atlasjs/nebula";
import { INERTIAL_ENGINE, PhysicsWorld } from "@atlasjs/inertia";
import { Entity, NEXUS, NexusWorld, Unsubscribe } from "@atlasjs/nexus";
import { ASSET_MANAGER, AssetManager } from "@atlasjs/assets";

import { SCRIPT_MANAGER } from "./tokens";
import { CameraManager, CAMERA_MANAGER } from "./camera";
import { registerSystem } from "./registerSystem";
import { SpriteLoader } from "./assets";

import { ScriptManager } from "./scripting";

import {
  AnimatorSystem,
  CameraSyncSystem,
  PhysicsPullSystem,
  PhysicsPushSystem,
  PlayerInputSystem,
  SpriteRenderSystem,
  TransformPropagationSystem,
} from "./systems";

import {
  Animator,
  Camera,
  PhysicsBodyRef,
  PlayerInput,
  RigidBody2D,
  SpriteRender,
  Transform2D,
  WorldTransform2D,
} from "./components";

export class GameplayPlugin extends Plugin {
  private readonly logger: Logger;

  private scriptManager!: ScriptManager;
  private handles: StepHandle[];
  private unsubscribers: Unsubscribe[];

  public constructor() {
    super("gameplay-plugin", {
      requires: [NEXUS, NEBULA_RENDERER, INERTIAL_ENGINE, ASSET_MANAGER],
      provides: [SCRIPT_MANAGER, CAMERA_MANAGER],
    });
    this.logger = createLogger(GameplayPlugin.name);
    this.handles = [];
    this.unsubscribers = [];
  }

  //prettier-ignore
  public async install(engine: Engine): Promise<void> {
    const world: NexusWorld = await engine.services.wait(NEXUS);
    const nebula: NebulaRenderer = await engine.services.wait(NEBULA_RENDERER);
    const inertia: PhysicsWorld = await engine.services.wait(INERTIAL_ENGINE);
    const assets: AssetManager = await engine.services.wait(ASSET_MANAGER);
    assets.register(new SpriteLoader());

    this.scriptManager = new ScriptManager(world, engine.services);

    const physicsPushSystem: PhysicsPushSystem = new PhysicsPushSystem(inertia);
    const physicsPullSystem: PhysicsPullSystem = new PhysicsPullSystem();
    const spriteRenderSystem: SpriteRenderSystem = new SpriteRenderSystem(nebula);
    const playerInputSystem: PlayerInputSystem = new PlayerInputSystem(engine.services);
    const animatorSystem: AnimatorSystem = new AnimatorSystem();
    const transformPropagationSystem: TransformPropagationSystem = new TransformPropagationSystem();
    const cameraManager: CameraManager = new CameraManager(nebula);
    const cameraSyncSystem: CameraSyncSystem = new CameraSyncSystem(cameraManager, nebula);

    world
      .defineComponent(RigidBody2D)
      .defineComponent(Transform2D)
      .defineComponent(WorldTransform2D)
      .defineComponent(SpriteRender)
      .defineComponent(PhysicsBodyRef)
      .defineComponent(PlayerInput)
      .defineComponent(Animator)
      .defineComponent(Camera);

    this.unsubscribers.push(
      world.onRemove(PhysicsBodyRef, (_entity: Entity, ref: PhysicsBodyRef) => {
        inertia.destroyRigidBody(ref.body);
      }),

      world.onRemove(RigidBody2D, (entity: Entity) => {
        if (world.hasComponent(entity, PhysicsBodyRef)) {
          world.removeComponent(entity, PhysicsBodyRef);
        }
      }),

      world.onRemove(SpriteRender, (entity: Entity) => {
        spriteRenderSystem.unmount(entity);
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

    const { fixed, update, render } = engine.scheduler;

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

    this.logger.log("GameplayPlugin installed.");
    engine.services.provide(SCRIPT_MANAGER, this.scriptManager);
    engine.services.provide(CAMERA_MANAGER, cameraManager);

    this.deferred.resolve();
  }

  public uninstall(): void {
    this.logger.log("Uninstalling GameplayPlugin.");
    for (const handle of this.handles) handle.remove();
    for (const off of this.unsubscribers) off();
    this.handles = [];
    this.unsubscribers = [];
  }
}
