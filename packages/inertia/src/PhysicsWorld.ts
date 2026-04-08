import { Vec2 } from "@atlasjs/math";
import { RigidBodyDesc, ColliderDesc } from "./inertial-type";
import { Collider } from "./Collider";
import { PhysicsQuery } from "./PhysicsQuery";
import { RigidBody } from "./RigidBody";

export interface PhysicsWorld {
  init?(): Promise<void>;
  step(): void;
  setGravity(x: number, y: number): void;
  getGravity(): Vec2;
  createRigidBody(descriptor: RigidBodyDesc): RigidBody;
  destroyRigidBody(body: RigidBody): void;
  createCollider(descriptor: ColliderDesc, body?: RigidBody): Collider;
  destroyCollider(collider: Collider): void;
  query(): PhysicsQuery;
  clear(): void;
}
