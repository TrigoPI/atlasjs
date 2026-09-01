import RAPIER from "@dimforge/rapier2d-compat";

import { Vec2 } from "@atlasjs/math";
import { RigidBody, RigidBodyType } from "@atlasjs/inertia";

import { PhysicsUnitConverter } from "./PhysicsUnitConverter";
import { RapierRigidBodyOption } from "./rapier-types";
import { mapRigidBodyType } from "./mappers/map-rigid-body-type";

export class RapierRigidBody implements RigidBody {
  public readonly id: string;
  public readonly rapierBody: RAPIER.RigidBody;

  private bodyType: RigidBodyType;
  private rotationLocked: boolean;

  private readonly translation: Vec2;
  private readonly velocity: Vec2;
  private readonly tmpVec2: Vec2;

  private readonly converter: PhysicsUnitConverter;

  public constructor(
    rapierBody: RAPIER.RigidBody,
    options: RapierRigidBodyOption,
  ) {
    this.id = options.id;
    this.bodyType = options.type;
    this.rotationLocked = options.lockRotation;
    this.rapierBody = rapierBody;

    this.converter = new PhysicsUnitConverter(options.unitScale);
    this.translation = new Vec2();
    this.velocity = new Vec2();
    this.tmpVec2 = new Vec2();
  }

  public get type(): RigidBodyType {
    return this.bodyType;
  }

  public isEnabled(): boolean {
    return this.rapierBody.isEnabled();
  }

  public isSleeping(): boolean {
    return this.rapierBody.isSleeping();
  }

  public isRotationLocked(): boolean {
    return this.rotationLocked;
  }

  public getTranslation(): Vec2 {
    const { x, y }: RAPIER.Vector = this.rapierBody.translation();
    this.translation.set(x, y);
    return this.converter.vecToWorldInto(this.translation);
  }

  public getLinearVelocity(): Vec2 {
    const { x, y }: RAPIER.Vector = this.rapierBody.linvel();
    this.velocity.set(x, y);
    return this.converter.vecToWorldInto(this.velocity);
  }

  public getRotation(): number {
    return this.rapierBody.rotation();
  }

  public getAngularVelocity(): number {
    return this.rapierBody.angvel();
  }

  public getLinearDamping(): number {
    return this.rapierBody.linearDamping();
  }

  public getAngularDamping(): number {
    return this.rapierBody.angularDamping();
  }

  public getGravityScale(): number {
    return this.rapierBody.gravityScale();
  }

  public getMass(): number {
    return this.rapierBody.mass();
  }

  public setTranslation(x: number, y: number): this {
    const translation: RAPIER.Vector = new RAPIER.Vector2(0, 0);

    this.tmpVec2.set(x, y);
    this.converter.vecToPhysicsInto(this.tmpVec2);

    translation.x = this.tmpVec2.x;
    translation.y = this.tmpVec2.y;

    this.rapierBody.setTranslation(translation, true);

    return this;
  }

  public setNextKinematicTranslation(x: number, y: number): this {
    const translation: RAPIER.Vector = new RAPIER.Vector2(0, 0);

    this.tmpVec2.set(x, y);
    this.converter.vecToPhysicsInto(this.tmpVec2);

    translation.x = this.tmpVec2.x;
    translation.y = this.tmpVec2.y;

    this.rapierBody.setNextKinematicTranslation(translation);

    return this;
  }

  public setLinearVelocity(x: number, y: number): this {
    const velocity: RAPIER.Vector = new RAPIER.Vector2(0, 0);

    this.tmpVec2.set(x, y);
    this.converter.vecToPhysicsInto(this.tmpVec2);

    velocity.x = this.tmpVec2.x;
    velocity.y = this.tmpVec2.y;

    this.rapierBody.setLinvel(velocity, true);

    return this;
  }

  public setRotation(angleRad: number): this {
    this.rapierBody.setRotation(angleRad, true);
    return this;
  }

  public setAngularVelocity(value: number): this {
    this.rapierBody.setAngvel(value, true);
    return this;
  }

  public setAngularDamping(value: number): this {
    this.rapierBody.setAngularDamping(value);
    return this;
  }

  public setGravityScale(value: number): this {
    this.rapierBody.setGravityScale(value, true);
    return this;
  }

  public setLinearDamping(value: number): this {
    this.rapierBody.setLinearDamping(value);
    return this;
  }

  public setMass(value: number): this {
    this.rapierBody.setAdditionalMass(value, true);
    return this;
  }

  public setEnabled(value: boolean): this {
    this.rapierBody.setEnabled(value);
    return this;
  }

  public setRotationLocked(value: boolean): this {
    this.rapierBody.lockRotations(value, true);

    if (value) {
      this.rapierBody.setAngvel(0, true);
    }

    this.rotationLocked = value;
    return this;
  }

  public setUserData(data: unknown): this {
    this.rapierBody.userData = data;
    return this;
  }

  public setBodyType(type: RigidBodyType): this {
    this.rapierBody.setBodyType(mapRigidBodyType(type), true);
    this.bodyType = type;
    return this;
  }

  public getUserData<T = unknown>(): T | undefined {
    return this.rapierBody.userData as T | undefined;
  }

  public applyForce(x: number, y: number, wake: boolean = true): void {
    this.rapierBody.addForce({ x, y }, wake);
  }

  public applyImpulse(x: number, y: number, wake: boolean = true): void {
    this.rapierBody.applyImpulse({ x, y }, wake);
  }

  public applyAngularImpulse(value: number, wake: boolean = true): void {
    this.rapierBody.applyTorqueImpulse(value, wake);
  }

  public applyTorque(value: number, wake: boolean = true): void {
    this.rapierBody.addTorque(value, wake);
  }

  public wakeUp(): void {
    this.rapierBody.wakeUp();
  }

  public sleep(): void {
    this.rapierBody.sleep();
  }
}
