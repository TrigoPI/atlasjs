import { CharacterController } from "@atlasjs/inertia";

export class CharacterControllerRef {
  public readonly controller: CharacterController;

  public constructor(controller: CharacterController) {
    this.controller = controller;
  }
}
