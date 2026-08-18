import type { Vec2 } from "@atlasjs/math";
import type { Entity } from "@atlasjs/nexus";

import {
  AtlasScript,
  CameraApi,
  InputApi,
  registerScriptMetadata,
  ScriptMetadata,
  SpriteRender,
  Transform,
  type GameEntity,
} from "@atlasjs/gameplay";

import { readAimAngle } from "./aim";

type SwordSortingScriptProps = {
  anchor: Entity;
  sortingFront: number;
  sortingBehind: number;
};

export class SwordSortingScript extends AtlasScript<SwordSortingScriptProps> {
  private readonly anchor: GameEntity;
  private readonly sortingFront: number;
  private readonly sortingBehind: number;

  private renderer: SpriteRender;

  private input: InputApi;
  private camera: CameraApi;

  public onCreate(): void {
    this.renderer = this.requireComponent(SpriteRender);

    this.input = this.getService(InputApi);
    this.camera = this.getService(CameraApi);
  }

  public onUpdate(): void {
    const anchorTransform: Transform = this.anchor.requireComponent(Transform);
    const anchorWorldPos: Vec2 = anchorTransform.worldPosition;

    const angle: number = readAimAngle(this.input, this.camera, anchorWorldPos);

    if (angle < 0) {
      this.renderer.sortingOrder = this.sortingBehind;
    } else {
      this.renderer.sortingOrder = this.sortingFront;
    }
  }
}

registerScriptMetadata(SwordSortingScript, {
  exposed: {
    anchor: ScriptMetadata.entity({ required: true }),
    sortingFront: ScriptMetadata.field({ required: true }),
    sortingBehind: ScriptMetadata.field({ required: true }),
  },
});
