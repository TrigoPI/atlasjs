import { Vec2 } from "@atlasjs/math";
import { Collider } from "./Collider";
import { RigidBody } from "./RigidBody";

export type RigidBodyType = "static" | "dynamic" | "kinematic";

export type PhysicsWorldOptions = {
  gravity?: Vec2;
  unitsPerMeter?: number;
};

export type RigidBodyDesc = {
  type?: RigidBodyType;
  translation?: Vec2;
  rotation?: number;
  linearVelocity?: Vec2;
  angularVelocity?: number;
  linearDamping?: number;
  angularDamping?: number;
  gravityScale?: number;
  canSleep?: boolean;
  enabled?: boolean;
  userData?: unknown;
};

export type ColliderDesc = {
  shape: ColliderShapeDesc;
  translation?: Vec2;
  rotation?: number;
  sensor?: boolean;
  friction?: number;
  restitution?: number;
  density?: number;
  collisionGroup?: number;
  collisionMask?: number;
  enabled?: boolean;
  events?: boolean;
  userData?: unknown;
};

export type BoxColliderShapeDesc = {
  type: "box";
  width: number;
  height: number;
};

export type CircleColliderShapeDesc = {
  type: "circle";
  radius: number;
};

export type CapsuleColliderShapeDesc = {
  type: "capsule";
  radius: number;
  halfHeight: number;
};

export type SegmentColliderShapeDesc = {
  type: "segment";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type PolygonColliderShapeDesc = {
  type: "polygon";
  points: Vec2[];
};

export type AABB = {
  min: Vec2;
  max: Vec2;
};

export type RaycastHit = {
  collider: Collider;
  body: RigidBody | null;
  normal: Vec2;
  toi: number;
};

export type ColliderShapeDesc =
  | BoxColliderShapeDesc
  | CircleColliderShapeDesc
  | CapsuleColliderShapeDesc
  | SegmentColliderShapeDesc
  | PolygonColliderShapeDesc;

export type CharacterControllerOptions = {
  readonly maxSpeed?: number;
  readonly acceleration?: number;
  readonly deceleration?: number;
  readonly airAcceleration?: number;
  readonly airDeceleration?: number;
  readonly jumpSpeed?: number;
};

export type CharacterControllerState = {
  readonly moveInput: number;
  readonly grounded: boolean;
  readonly jumpQueued: boolean;
};

export type CollisionHandler = (
  a: Collider,
  b: Collider,
  started: boolean,
) => void;
