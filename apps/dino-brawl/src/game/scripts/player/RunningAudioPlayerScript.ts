import {
  registerScriptMetadata,
  ScriptMetadata,
  type Prefab,
} from "@atlasjs/gameplay";

import { MovementEmitterScript } from "./MovementEmitterScript";

export class RunningAudioPlayerScript extends MovementEmitterScript<{
  audioPrefab: Prefab;
}> {
  protected override walkInterval: number = 0.5;
  protected override runInterval: number = 0.4;

  private readonly audioPrefab: Prefab;

  protected emit(): void {
    this.instantiate(this.audioPrefab);
  }
}

registerScriptMetadata(RunningAudioPlayerScript, {
  exposed: {
    audioPrefab: ScriptMetadata.field({ required: true }),
  },
});
