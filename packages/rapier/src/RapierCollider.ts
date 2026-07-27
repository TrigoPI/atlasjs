import RAPIER from "@dimforge/rapier2d-compat";
import { Collider, RigidBody } from "@atlasjs/inertia";
import { RapierColliderOption } from "./rapier-types";

export class RapierCollider implements Collider {
  public readonly id: string;
  public readonly rapierCollider: RAPIER.Collider;

  private readonly body: RigidBody | null;
  private userData: unknown;

  public constructor(
    rapierCollider: RAPIER.Collider,
    options: RapierColliderOption,
  ) {
    this.body = options.body;
    this.id = options.id;
    this.rapierCollider = rapierCollider;
    this.userData = options.userData;
  }

  public isSensor(): boolean {
    return this.rapierCollider.isSensor();
  }

  public isEnabled(): boolean {
    return this.rapierCollider.isEnabled();
  }

  public setSensor(value: boolean): this {
    this.rapierCollider.setSensor(value);
    return this;
  }

  public setCollisionGroup(group: number): this {
    this.rapierCollider.setCollisionGroups(group);
    return this;
  }

  public setRestitution(value: number): this {
    this.rapierCollider.setRestitution(value);
    return this;
  }

  public setCollisionMask(mask: number): this {
    this.rapierCollider.setSolverGroups(mask);
    return this;
  }

  public setFriction(value: number): this {
    this.rapierCollider.setFriction(value);
    return this;
  }

  public setDensity(value: number): this {
    this.rapierCollider.setDensity(value);
    return this;
  }

  public setEnabled(value: boolean): this {
    this.rapierCollider.setEnabled(value);
    return this;
  }

  public getCollisionGroup(): number {
    return this.rapierCollider.collisionGroups();
  }

  public getCollisionMask(): number {
    return this.rapierCollider.solverGroups();
  }

  public getRestitution(): number {
    return this.rapierCollider.restitution();
  }

  public getFriction(): number {
    return this.rapierCollider.friction();
  }

  public getDensity(): number {
    return this.rapierCollider.density();
  }

  public getUserData<T = unknown>(): T | undefined {
    return this.userData as T | undefined;
  }

  public setUserData(data: unknown): this {
    this.userData = data;
    return this;
  }

  public getRigidBody(): RigidBody | null {
    return this.body;
  }
}
