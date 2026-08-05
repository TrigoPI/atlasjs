import { Vec2 } from "@atlasjs/math";
import { CharacterController } from "./CharacterController";
import {
  RigidBodyDesc,
  ColliderDesc,
  CollisionHandler,
  CharacterControllerOptions,
} from "./inertial-type";
import { Collider } from "./Collider";
import { PhysicsQuery } from "./PhysicsQuery";
import { RigidBody } from "./RigidBody";

export interface PhysicsWorld {
  init?(): Promise<void>;
  step(dt: number): void;
  drainCollisions(handler: CollisionHandler): void;
  setGravity(x: number, y: number): void;
  getGravity(): Vec2;
  createRigidBody(descriptor: RigidBodyDesc): RigidBody;
  destroyRigidBody(body: RigidBody): void;
  createCollider(descriptor: ColliderDesc, body?: RigidBody): Collider;
  destroyCollider(collider: Collider): void;
  createCharacterController(
    options?: CharacterControllerOptions,
  ): CharacterController;
  destroyCharacterController(controller: CharacterController): void;
  query(): PhysicsQuery;
  clear(): void;
}
