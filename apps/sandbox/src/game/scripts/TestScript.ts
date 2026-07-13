import { AtlasScript, RigidBody2D, Transform2D } from "@atlasjs/gameplay";

export class TestScript extends AtlasScript {
  public onCreate(): void {
    this.addComponent(Transform2D);
    this.addComponent(RigidBody2D);

    this.rigidbody.type = "kinematic";

    this.transform.setScale(3, 3).setPosition(400, 300);
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
