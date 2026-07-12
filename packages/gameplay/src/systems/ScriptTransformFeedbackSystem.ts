import { NexusSystem, NexusSystemContext } from "@atlasjs/nexus";
import { Transform2D } from "../components";

import {
  ScriptComponentRuntimeStorage,
  ScriptComponentStorage,
  Transform2DComponent,
  Transform2DSyncState,
} from "../scripting";

export class ScriptTransformFeedbackSystem implements NexusSystem {
  private readonly componentStorage: ScriptComponentStorage;
  private readonly runtimeStorage: ScriptComponentRuntimeStorage;

  public constructor(
    componentStorage: ScriptComponentStorage,
    runtimeStorage: ScriptComponentRuntimeStorage,
  ) {
    this.componentStorage = componentStorage;
    this.runtimeStorage = runtimeStorage;
  }

  // prettier-ignore
  public update({ world }: NexusSystemContext): void {
    const entries = this.componentStorage.entries(Transform2DComponent);

    for (const [entity, scriptTransform] of entries) {
      const transform: Transform2D = world.requireComponent(entity, Transform2D);

      scriptTransform.position.set(transform.position.x, transform.position.y);
      scriptTransform.scale.set(transform.scale.x, transform.scale.y);
      scriptTransform.rotation = transform.rotation;

      const state: Transform2DSyncState = new Transform2DSyncState();
      const syncState: Transform2DSyncState = this.runtimeStorage.getOrCreate(entity, Transform2DComponent, state);

      syncState.capture(scriptTransform);
    }
  }
}
