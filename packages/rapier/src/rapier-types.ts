import { Collider, RigidBody, RigidBodyType } from "@atlasjs/inertia";

export type ColliderResolver = (handle: number) => Collider | null;
export type RigidBodyResolver = (handle: number) => RigidBody | null;

export type RapierRigidBodyOption = {
  id: string;
  type: RigidBodyType;
  unitScale: number;
};

export type RapierColliderOption = {
  id: string;
  body: RigidBody | null;
  userData?: unknown;
};
