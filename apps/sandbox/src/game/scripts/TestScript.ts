import {
  AtlasScript,
  InputApi,
  Key,
  RigidBody2DComponent,
  Transform2DComponent,
} from "@atlasjs/gameplay";

export class TestScript extends AtlasScript {
  private input!: InputApi;
  private transform!: Transform2DComponent;
  private rigidbody!: RigidBody2DComponent;

  private readonly speed: number = 250;

  public onCreate(): void {
    this.input = this.getService(InputApi);
    this.transform = this.addComponent(Transform2DComponent);
    this.rigidbody = this.addComponent(RigidBody2DComponent);

    this.rigidbody.type = "kinematic";

    this.transform.setScale(3, 3).setPosition(400, 300);
  }

  public onUpdate(dt: number): void {
    let dx: number = 0;
    let dy: number = 0;

    if (this.input.isDown(Key.D) || this.input.isDown(Key.ArrowRight)) dx += 1;
    if (this.input.isDown(Key.A) || this.input.isDown(Key.ArrowLeft)) dx -= 1;
    if (this.input.isDown(Key.W) || this.input.isDown(Key.ArrowUp)) dy -= 1;
    if (this.input.isDown(Key.S) || this.input.isDown(Key.ArrowDown)) dy += 1;

    if (dx !== 0 || dy !== 0) {
      this.transform.translate(dx * this.speed * dt, dy * this.speed * dt);
    }
  }

  public onDestroy(): void {}
}
