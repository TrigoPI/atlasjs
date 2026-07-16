import {
  AtlasScript,
  RigidBody2DComponent,
  SpriteRendererComponent,
} from "@atlasjs/gameplay";

export class WallScript extends AtlasScript {
  private rb!: RigidBody2DComponent;
  private spriteRenderer!: SpriteRendererComponent;

  public onCreate(): void {
    this.rb = this.addComponent(RigidBody2DComponent);
    this.spriteRenderer = this.requireComponent(SpriteRendererComponent);

    this.rb.type = "static";

    this.spriteRenderer.setColor(0, 1, 0, 0.5).setSortingOrder(-10);
  }
}
