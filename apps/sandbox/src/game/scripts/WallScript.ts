import {
  AtlasScript,
  registerScriptMetadata,
  RigidBody2DComponent,
  Sprite,
  SpriteRendererComponent,
  Transform2DComponent,
} from "@atlasjs/gameplay";

export class WallScript extends AtlasScript<{ sprite: Sprite }> {
  private readonly sprite: Sprite;

  private rb: RigidBody2DComponent;
  private spriteRenderer: SpriteRendererComponent;
  private transform: Transform2DComponent;

  // prettier-ignore
  public onCreate(): void {
    this.transform = this.addComponent(Transform2DComponent);
    this.rb = this.addComponent(RigidBody2DComponent);
    this.spriteRenderer = this.addComponent(SpriteRendererComponent, this.sprite);

    this.rb.type = "static";

    this.spriteRenderer.setColor(0, 1, 0, 0.5).setSortingOrder(10);
    this.transform.setScale(0.3, 0.3).setPosition(200, 300);
  }
}

registerScriptMetadata(WallScript, {
  exposed: {
    sprite: { required: true },
  },
});
