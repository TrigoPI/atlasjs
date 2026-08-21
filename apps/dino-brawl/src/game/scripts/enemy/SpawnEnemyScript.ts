import type { Vec2 } from "@atlasjs/math";
import type { AudioClip } from "@atlasjs/audio";

import type {
  EnemyPrefabProps,
  ImpactPrefabProps,
} from "@dino-brawl/game/prefabs";

import {
  AtlasScript,
  CameraApi,
  InputApi,
  Key,
  registerScriptMetadata,
  ScriptMetadata,
  Sprite,
  SpriteAnimation,
  type Prefab,
} from "@atlasjs/gameplay";

type SpawnEnemyScriptProps = {
  readonly sprite: Sprite;
  readonly hitClip: AudioClip;
  readonly enemy: Prefab<EnemyPrefabProps>;
  readonly impactPrefab: Prefab<ImpactPrefabProps>;
  readonly clips: () => Record<string, SpriteAnimation>;
};

export class SpawnEnemyScript extends AtlasScript<SpawnEnemyScriptProps> {
  private readonly sprite: Sprite;
  private readonly enemy: Prefab<EnemyPrefabProps>;
  private readonly impactPrefab: Prefab<ImpactPrefabProps>;
  private readonly hitClip: AudioClip;
  private readonly clips: () => Record<string, SpriteAnimation>;

  private input: InputApi;
  private camera: CameraApi;

  public onCreate(): void {
    this.input = this.getService(InputApi);
    this.camera = this.getService(CameraApi);
  }

  public onUpdate(): void {
    if (this.input.isPressed(Key.MouseRight)) {
      const screenPos: Vec2 = this.input.mousePosition;
      const worldPos: Vec2 = this.camera.screenToWorld(screenPos);

      this.instantiate(this.enemy, {
        position: worldPos,
        sprite: this.sprite,
        hitClip: this.hitClip,
        impactPrefab: this.impactPrefab,
        clips: this.clips(),
      });
    }
  }
}

registerScriptMetadata(SpawnEnemyScript, {
  exposed: {
    sprite: ScriptMetadata.field({ required: true }),
    clips: ScriptMetadata.field({ required: true }),
    enemy: ScriptMetadata.field({ required: true }),
    impactPrefab: ScriptMetadata.field({ required: true }),
    hitClip: ScriptMetadata.field({ required: true }),
  },
});
