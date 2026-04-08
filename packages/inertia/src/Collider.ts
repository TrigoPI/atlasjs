import { RigidBody } from "./RigidBody";

export interface Collider {
  readonly id: string;

  isSensor(): boolean;
  isEnabled(): boolean;

  setSensor(value: boolean): this;
  setCollisionGroup(group: number): this;
  setRestitution(value: number): this;
  setCollisionMask(mask: number): this;
  setFriction(value: number): this;
  setDensity(value: number): this;
  setEnabled(value: boolean): this;

  getCollisionGroup(): number;
  getCollisionMask(): number;
  getRestitution(): number;
  getFriction(): number;
  getDensity(): number;

  getRigidBody(): RigidBody | null;
}
