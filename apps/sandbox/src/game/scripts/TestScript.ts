import {
  AtlasScript,
  RigidBody2DComponent,
  Transform2DComponent,
} from "@atlasjs/gameplay";

export class TestScript extends AtlasScript {
  private transform: Transform2DComponent;
  private rigidBody: RigidBody2DComponent;

  public onCreate(): void {
    this.transform = this.addComponent(Transform2DComponent);
    this.rigidBody = this.addComponent(RigidBody2DComponent);

    this.rigidBody.type = "kinematic";

    this.transform.scale.set(3, 3);
    this.transform.position.set(400, 300);
  }

  public onUpdate(dt: number): void {
    this.rigidBody.rotation += 1 * dt;
  }

  public onFixedUpdate(): void {
    // callback called on fixed update
  }

  public onDestroy(): void {
    // callback called when the entity is destroyed
  }
}
