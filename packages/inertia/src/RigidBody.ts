import { Vec2 } from "@atlasjs/math";
import { RigidBodyType } from "./inertial-type";

export interface RigidBody {
  readonly id: string;
  readonly type: RigidBodyType;

  isSleeping(): boolean;
  isEnabled(): boolean;
  getTranslation(): Vec2;
  getLinearVelocity(): Vec2;
  getRotation(): number;
  getAngularVelocity(): number;
  getLinearDamping(): number;
  getAngularDamping(): number;
  getMass(): number;
  getGravityScale(): number;
  getUserData<T = unknown>(): T | undefined;

  setTranslation(x: number, y: number): this;
  setNextKinematicTranslation(x: number, y: number): this;
  setLinearVelocity(x: number, y: number): this;
  setRotation(angleRad: number): this;
  setAngularVelocity(value: number): this;
  setAngularDamping(value: number): this;
  setGravityScale(value: number): this;
  setLinearDamping(value: number): this;
  setMass(value: number): this;
  setEnabled(value: boolean): this;
  setUserData(data: unknown): this;
  setBodyType(type: RigidBodyType): this;

  applyForce(x: number, y: number, wake?: boolean): void;
  applyImpulse(x: number, y: number, wake?: boolean): void;
  applyAngularImpulse(value: number, wake?: boolean): void;
  applyTorque(value: number, wake?: boolean): void;

  wakeUp(): void;
  sleep(): void;
}
