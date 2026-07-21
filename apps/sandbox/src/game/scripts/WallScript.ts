import {
  AtlasScript,
  registerScriptMetadata,
  RigidBody,
  ScriptMetadata,
  Sprite,
  SpriteRenderer,
  Transform,
} from "@atlasjs/gameplay";

export class WallScript extends AtlasScript<{ sprite: Sprite }> {
  private readonly sprite: Sprite;

  private rb: RigidBody;
  private spriteRenderer: SpriteRenderer;
  private transform: Transform;

  // prettier-ignore
  public onCreate(): void {
    this.transform = this.addComponent(Transform);
    this.rb = this.addComponent(RigidBody);
    this.spriteRenderer = this.addComponent(SpriteRenderer, this.sprite);

    this.rb.type = "static";

    this.spriteRenderer.color.set(0, 1, 0, 0.5);
    this.spriteRenderer.sortingOrder = 10;
    this.transform.setScale(0.3, 0.3).setPosition(200, 300);
  }
}

registerScriptMetadata(WallScript, {
  exposed: {
    sprite: ScriptMetadata.field({ required: true }),
  },
});
