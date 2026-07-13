import { createLogger, Logger } from "@atlasjs/utils";
import { Engine, Plugin, PRIORITY } from "@atlasjs/core";
import { NEBULA_RENDERER, NebulaRenderer } from "@atlasjs/nebula";
import { INERTIAL_ENGINE, PhysicsWorld, RigidBody } from "@atlasjs/inertia";
import { NEXUS, NexusWorld, SparseSet, SystemScheduler } from "@atlasjs/nexus";

import { SCRIPT_MANAGER } from "./tokens";

import {
  RigidBody2DRequestSystem,
  RigidBody2DSystem,
  RigidBodyWriteBackSystem,
  ScriptTransformFeedbackSystem,
  ScriptTransformRequestSystem,
  SpriteRenderSystem,
  TransformRequestResolveSystem,
  TransformWriteRequestCleanupSystem,
} from "./systems";

import {
  ScriptComponentRuntimeStorage,
  ScriptComponentStorage,
  ScriptManager,
} from "./scripting";

import {
  RigidBody2D,
  SpriteRender,
  Transform2D,
  TransformWriteRequest,
} from "./components";

export class GameplayPlugin extends Plugin {
  private readonly logger: Logger;

  private systemManager!: SystemScheduler;
  private scriptManager!: ScriptManager;

  public constructor() {
    super("gameplay-plugin", {
      requires: [NEXUS, NEBULA_RENDERER, INERTIAL_ENGINE],
      provides: [SCRIPT_MANAGER],
    });
    this.logger = createLogger(GameplayPlugin.name);
  }

  //prettier-ignore
  public async install(engine: Engine): Promise<void> {
    const world: NexusWorld = await engine.services.wait(NEXUS);
    const nebula: NebulaRenderer = await engine.services.wait(NEBULA_RENDERER);
    const inertia: PhysicsWorld = await engine.services.wait(INERTIAL_ENGINE);

    const componentStorage: ScriptComponentStorage = new ScriptComponentStorage();
    const runtimeStorage: ScriptComponentRuntimeStorage = new ScriptComponentRuntimeStorage();
    const runtimeBodiesStorage: SparseSet<RigidBody> = new SparseSet();

    this.systemManager = new SystemScheduler(world);
    this.scriptManager = new ScriptManager(componentStorage);

    const scriptTransformRequestSystem: ScriptTransformRequestSystem = new ScriptTransformRequestSystem(componentStorage, runtimeStorage);
    const rigidBody2DRequestSystem: RigidBody2DRequestSystem = new RigidBody2DRequestSystem(componentStorage);

    const transformRequestResolveSystem: TransformRequestResolveSystem = new TransformRequestResolveSystem(runtimeBodiesStorage);
    const scriptTransformFeedbackSystem: ScriptTransformFeedbackSystem = new ScriptTransformFeedbackSystem(componentStorage, runtimeStorage);
    const transformWriteRequestCleanupSystem: TransformWriteRequestCleanupSystem = new TransformWriteRequestCleanupSystem();

    const rigidBody2dSystem: RigidBody2DSystem = new RigidBody2DSystem(inertia, runtimeBodiesStorage);
    const spriteRenderSystem: SpriteRenderSystem = new SpriteRenderSystem(nebula);
    const rigidBodyWriteBackSystem: RigidBodyWriteBackSystem = new RigidBodyWriteBackSystem(runtimeBodiesStorage);

    world
      .defineComponent(RigidBody2D)
      .defineComponent(Transform2D)
      .defineComponent(SpriteRender)
      .defineComponent(TransformWriteRequest);

    this.systemManager
      .add("update", scriptTransformRequestSystem)
      .add("update", rigidBody2DRequestSystem)
      .add("update", rigidBody2dSystem)
      .add("update", transformRequestResolveSystem)
      .add("update", rigidBodyWriteBackSystem)
      .add("update", scriptTransformFeedbackSystem)
      .add("update", spriteRenderSystem)
      .add("update", transformWriteRequestCleanupSystem);

    engine.scheduler.onUpdate((dt: number) => this.update(dt), {
      name: "sprite-render-system:update",
      priority: PRIORITY.UPDATE_ECS,
    });

    this.logger.log("GameplayPlugin installed.");
    engine.services.provide(SCRIPT_MANAGER, this.scriptManager);

    this.deferred.resolve();
  }

  public update(dt: number): void {
    this.scriptManager.update(dt);
    this.systemManager.runPhase("update", dt);
    this.systemManager.runPhase("lateUpdate", dt);
  }

  public uninstall(): void {
    this.logger.log("Uninstalling GameplayPlugin.");
  }
}
