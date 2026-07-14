import {
  AtlasScript,
  RigidBody2DComponent,
  Transform2DComponent,
} from "@atlasjs/gameplay";

export class TestScript extends AtlasScript {
  private transform!: Transform2DComponent;
  private rigidbody!: RigidBody2DComponent;

  public onCreate(): void {
    this.transform = this.addComponent(Transform2DComponent);
    this.rigidbody = this.addComponent(RigidBody2DComponent);

    this.rigidbody.type = "kinematic";

    this.transform.setScale(3, 3).setPosition(400 * Math.random(), 300);
  }

  public onUpdate(dt: number): void {
    this.transform.rotate(1 * dt);
  }

  public onFixedUpdate(): void {
    // callback called on fixed update
  }

  public onDestroy(): void {
    // callback called when the entity is destroyed
  }
}
