import type { RunningParticlePrefabProps } from "../../prefabs";

import {
  registerScriptMetadata,
  ScriptMetadata,
  Transform,
  type Prefab,
} from "@atlasjs/gameplay";

import { MovementEmitterScript } from "./MovementEmitterScript";

export class RunningParticleSpawnerScript extends MovementEmitterScript<{
  runningParticlePrefab: Prefab<RunningParticlePrefabProps>;
}> {
  protected override walkInterval: number = 0.15;
  protected override runInterval: number = 0.09;

  private readonly runningParticlePrefab: Prefab<RunningParticlePrefabProps>;

  private transform: Transform;

  public override onCreate(): void {
    super.onCreate();
    this.transform = this.requireComponent(Transform);
  }

  protected emit(): void {
    this.instantiate(this.runningParticlePrefab, {
      position: this.transform.worldPosition.clone(),
      owner: this.entityId,
    });
  }
}

registerScriptMetadata(RunningParticleSpawnerScript, {
  exposed: {
    runningParticlePrefab: ScriptMetadata.field({ required: true }),
  },
});
