import { CharacterController, PhysicsWorld } from "@atlasjs/inertia";

export class CharacterControllerRef {
  public readonly controller: CharacterController;
  public readonly physics: PhysicsWorld;

  public constructor(controller: CharacterController, physics: PhysicsWorld) {
    this.controller = controller;
    this.physics = physics;
  }
}
