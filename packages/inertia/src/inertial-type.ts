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
  lockRotation?: boolean;
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
  readonly offset?: number;
  readonly slide?: boolean;
};

/**
 * A single contact point of a collision manifold.
 *
 * **Borrowed, not given.** Implementations own one instance and re-target it
 * before every dispatch, so this object — and the `Vec2` values it exposes —
 * are only valid for the duration of the callback that received it. A consumer
 * that needs to keep the point or the normal must copy them (`clone()`, or
 * `copyFrom` into a `Vec2` it owns). Storing the reference is silently wrong:
 * the values change at the next contact, not at the moment of the mistake.
 * Think of it as a pooled DOM event.
 */
export type ContactPoint = {
  /** Contact position in world space, in game units (already converted from rapier meters). */
  readonly point: Vec2;
  /** Contact normal in world space. A direction: it carries no unit and is never scaled. */
  readonly normal: Vec2;
  /** Magnitude of the impulse applied at this contact by the solver. */
  readonly impulse: number;
};

/**
 * Receives collision events drained from the physics world.
 *
 * `contact` is `null` whenever no manifold can exist for the event:
 *
 * - trigger events — a sensor produces an *intersection*, never a manifold, so
 *   a trigger never carries a contact;
 * - collision exit (`started === false`) — the pair no longer has a manifold by
 *   the time the event is drained;
 * - backends that do not provide contact data at all.
 *
 * `null` therefore means "this event, or this backend, cannot produce a
 * contact". It never means that reading the contact failed.
 */
export type CollisionHandler = (
  a: Collider,
  b: Collider,
  started: boolean,
  contact: ContactPoint | null,
) => void;
