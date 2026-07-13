import { createLogger, Logger } from "@atlasjs/utils";
import { Engine, Plugin, StepHandle } from "@atlasjs/core";
import { NEBULA_RENDERER, NebulaRenderer } from "@atlasjs/nebula";
import { INERTIAL_ENGINE, PhysicsWorld } from "@atlasjs/inertia";

import { SCRIPT_MANAGER } from "./tokens";
import { registerSystem } from "./registerSystem";

import { Entity, NEXUS, NexusWorld, Unsubscribe } from "@atlasjs/nexus";

import {
  PhysicsPullSystem,
  PhysicsPushSystem,
  RigidBody2DRequestSystem,
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
  PhysicsBodyRef,
  RigidBody2D,
  SpriteRender,
  Transform2D,
  TransformWriteRequest,
} from "./components";

export class GameplayPlugin extends Plugin {
  private readonly logger: Logger;

  private scriptManager!: ScriptManager;
  private handles: StepHandle[];
  private unsubscribers: Unsubscribe[];

  public constructor() {
    super("gameplay-plugin", {
      requires: [NEXUS, NEBULA_RENDERER, INERTIAL_ENGINE],
      provides: [SCRIPT_MANAGER],
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

    const componentStorage: ScriptComponentStorage = new ScriptComponentStorage();
    const runtimeStorage: ScriptComponentRuntimeStorage = new ScriptComponentRuntimeStorage();

    this.scriptManager = new ScriptManager(componentStorage);

    const scriptTransformRequestSystem = new ScriptTransformRequestSystem(componentStorage, runtimeStorage);
    const rigidBody2DRequestSystem = new RigidBody2DRequestSystem(componentStorage);
    const physicsPushSystem = new PhysicsPushSystem(inertia);
    const physicsPullSystem = new PhysicsPullSystem();
    const transformRequestResolveSystem = new TransformRequestResolveSystem();
    const scriptTransformFeedbackSystem = new ScriptTransformFeedbackSystem(componentStorage, runtimeStorage);
    const transformWriteRequestCleanupSystem = new TransformWriteRequestCleanupSystem();
    const spriteRenderSystem = new SpriteRenderSystem(nebula);

    world
      .defineComponent(RigidBody2D)
      .defineComponent(Transform2D)
      .defineComponent(SpriteRender)
      .defineComponent(PhysicsBodyRef)
      .defineComponent(TransformWriteRequest);

    this.unsubscribers.push(
      world.onRemove(PhysicsBodyRef, (_entity: Entity, ref: PhysicsBodyRef) => {
        inertia.destroyRigidBody(ref.body);
      }),
      world.onRemove(RigidBody2D, (entity: Entity) => {
        if (world.hasComponent(entity, PhysicsBodyRef)) {
          world.removeComponent(entity, PhysicsBodyRef);
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
      registerSystem(fixed, world, scriptTransformRequestSystem, {
        name: "gameplay:script-transform-request",
        stage: "PhysicsRequest",
      }),
      registerSystem(fixed, world, rigidBody2DRequestSystem, {
        name: "gameplay:rigidbody-request",
        stage: "PhysicsRequest",
        after: "gameplay:script-transform-request",
      }),
      registerSystem(fixed, world, physicsPushSystem, {
        name: "gameplay:physics-push",
        stage: "PhysicsRequest",
        after: "gameplay:rigidbody-request",
      }),
      registerSystem(fixed, world, transformRequestResolveSystem, {
        name: "gameplay:transform-resolve",
        stage: "PhysicsRequest",
        after: "gameplay:physics-push",
      }),
    );

    this.handles.push(
      registerSystem(fixed, world, physicsPullSystem, {
        name: "gameplay:physics-pull",
        stage: "PhysicsWriteback",
      }),
      registerSystem(fixed, world, scriptTransformFeedbackSystem, {
        name: "gameplay:script-feedback",
        stage: "PhysicsWriteback",
        after: "gameplay:physics-pull",
      }),
    );

    this.handles.push(
      registerSystem(fixed, world, transformWriteRequestCleanupSystem, {
        name: "gameplay:request-cleanup",
        stage: "Cleanup",
      }),
    );

    
    this.handles.push(
      update.add((ctx) => this.scriptManager.update(ctx.dt), {
        name: "gameplay:script-update",
        stage: "Logic",
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
