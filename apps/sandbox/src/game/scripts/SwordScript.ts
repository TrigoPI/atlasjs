import type { Vec2 } from "@atlasjs/math";

import {
  Sprite,
  AtlasScript,
  registerScriptMetadata,
  SpriteRenderer,
  Transform,
  CameraApi,
  InputApi,
} from "@atlasjs/gameplay";

const ANGLE_OFFSET = Math.PI / 4;

export class SwordScript extends AtlasScript<{
  sprite: Sprite;
  scale: number;
}> {
  private readonly sprite: Sprite;
  private readonly scale: number;

  private transform: Transform;
  private spriteRenderer: SpriteRenderer;

  private camera: CameraApi;
  private input: InputApi;

  // prettier-ignore
  public onCreate(): void {
    this.transform = this.addComponent(Transform);
    this.spriteRenderer = this.addComponent(SpriteRenderer, this.sprite);

    this.transform.setScale(this.scale, this.scale);
    this.spriteRenderer.sortingOrder = 10;

    this.camera = this.getService(CameraApi);
    this.input = this.getService(InputApi);
  }

  // prettier-ignore
  public onUpdate(): void {
    const mouseWorldPosition: Vec2 = this.camera.screenToWorld(this.input.mousePosition);
    const distMouseSword: Vec2 = mouseWorldPosition.sub(this.transform.worldPosition);
    const angle: number = Math.atan2(distMouseSword.y, distMouseSword.x);

    this.transform.setRotation(angle + ANGLE_OFFSET);
  }
}

registerScriptMetadata(SwordScript, {
  exposed: {
    sprite: { required: true },
    scale: { required: true },
  },
});
