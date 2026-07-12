import { NexusSystem, NexusSystemContext } from "@atlasjs/nexus";
import { createLogger, Logger } from "@atlasjs/utils";

import { Transform2D, TransformWriteRequest } from "../components";

import {
  ScriptComponentStorage,
  ScriptComponentRuntimeStorage,
  Transform2DComponent,
  Transform2DSyncState,
} from "../scripting";

export class ScriptTransformRequestSystem implements NexusSystem {
  private readonly componentStorage: ScriptComponentStorage;
  private readonly runtimeStorage: ScriptComponentRuntimeStorage;
  private readonly logger: Logger;

  public constructor(
    componentStorage: ScriptComponentStorage,
    runtimeStorage: ScriptComponentRuntimeStorage,
  ) {
    this.logger = createLogger(ScriptTransformRequestSystem.name);

    this.componentStorage = componentStorage;
    this.runtimeStorage = runtimeStorage;
  }

  // prettier-ignore
  public update({ world }: NexusSystemContext): void {
    const entries = this.componentStorage.entries(Transform2DComponent);

    for (const [entity, scriptTransform] of entries) {
      const state: Transform2DSyncState = new Transform2DSyncState();
      const syncState: Transform2DSyncState = this.runtimeStorage.getOrCreate(entity, Transform2DComponent, state);

      let request: TransformWriteRequest | undefined = world.getComponent(entity, TransformWriteRequest);

      if (!request) {
        request = world.addComponent(entity, TransformWriteRequest);
      }

      if (!world.hasComponent(entity, Transform2D)) {
        this.logger.log(`Adding Transform2D component to entity ${entity}`);
        world.addComponent(entity, Transform2D);
      }

      request.reset();

      if (this.hasPositionChanged(scriptTransform, syncState)) {
        request.setPosition(
          scriptTransform.position.x,
          scriptTransform.position.y,
        );
      }

      if (this.hasRotationChanged(scriptTransform, syncState)) {
        request.setRotation(scriptTransform.rotation);
      }

      if (this.hasScaleChanged(scriptTransform, syncState)) {
        request.setScale(scriptTransform.scale.x, scriptTransform.scale.y);
      }

      if (this.hasRequestChanged(request)) {
        world.removeComponent(entity, TransformWriteRequest);
      }
    }
  }

  private hasPositionChanged(
    scriptTransform: Transform2DComponent,
    syncState: Transform2DSyncState,
  ): boolean {
    return (
      scriptTransform.position.x !== syncState.lastPositionX ||
      scriptTransform.position.y !== syncState.lastPositionY
    );
  }

  private hasScaleChanged(
    scriptTransform: Transform2DComponent,
    syncState: Transform2DSyncState,
  ): boolean {
    return (
      scriptTransform.scale.x !== syncState.lastScaleX ||
      scriptTransform.scale.y !== syncState.lastScaleY
    );
  }

  private hasRotationChanged(
    scriptTransform: Transform2DComponent,
    syncState: Transform2DSyncState,
  ): boolean {
    return scriptTransform.rotation !== syncState.lastRotation;
  }

  private hasRequestChanged(request: TransformWriteRequest): boolean {
    return !request.hasPosition && !request.hasRotation && !request.hasScale;
  }
}
