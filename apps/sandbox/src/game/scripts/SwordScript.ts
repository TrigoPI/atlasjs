import {
  Sprite,
  AtlasScript,
  registerScriptMetadata,
  SpriteRendererComponent,
  Transform2DComponent,
} from "@atlasjs/gameplay";

export class SwordScript extends AtlasScript<{
  sprite: Sprite;
  scale: number;
}> {
  private readonly sprite: Sprite;
  private readonly scale: number;

  private transform: Transform2DComponent;
  private spriteRenderer: SpriteRendererComponent;

  // prettier-ignore
  public onCreate(): void {
    this.transform = this.addComponent(Transform2DComponent);
    this.spriteRenderer = this.addComponent(SpriteRendererComponent, this.sprite);

    this.transform.setScale(this.scale, this.scale);
    this.spriteRenderer.setSortingOrder(10);
  }
}

registerScriptMetadata(SwordScript, {
  exposed: {
    sprite: { required: true },
    scale: { required: true },
  },
});
