import { Vec2 } from "@atlasjs/math";

import {
  Collider,
  ColliderDesc,
  PhysicsQuery,
  PhysicsWorld,
  RigidBody,
  RigidBodyDesc,
  RigidBodyType,
} from "@atlasjs/inertia";

export class FakeRigidBody implements RigidBody {
  public readonly id: string;
  public type: RigidBodyType;

  private readonly translation: Vec2;
  private readonly linearVelocity: Vec2;
  private rotation: number;
  private angularVelocity: number;
  private mass: number;
  private enabled: boolean;
  private userData: unknown;

  public constructor(id: string, descriptor: RigidBodyDesc) {
    this.id = id;
    this.type = descriptor.type ?? "dynamic";

    this.translation = descriptor.translation?.clone() ?? new Vec2(0, 0);
    this.linearVelocity = descriptor.linearVelocity?.clone() ?? new Vec2(0, 0);
    this.rotation = descriptor.rotation ?? 0;
    this.angularVelocity = descriptor.angularVelocity ?? 0;
    this.mass = 1;
    this.enabled = descriptor.enabled ?? true;
    this.userData = descriptor.userData;
  }

  public integrate(dt: number): void {
    this.translation.x += this.linearVelocity.x * dt;
    this.translation.y += this.linearVelocity.y * dt;
    this.rotation += this.angularVelocity * dt;
  }

  public isSleeping(): boolean {
    return false;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getTranslation(): Vec2 {
    return this.translation;
  }

  public getLinearVelocity(): Vec2 {
    return this.linearVelocity;
  }

  public getRotation(): number {
    return this.rotation;
  }

  public getAngularVelocity(): number {
    return this.angularVelocity;
  }

  public getLinearDamping(): number {
    return 0;
  }

  public getAngularDamping(): number {
    return 0;
  }

  public getMass(): number {
    return this.mass;
  }

  public getGravityScale(): number {
    return 1;
  }

  public getUserData<T = unknown>(): T | undefined {
    return this.userData as T | undefined;
  }

  public setTranslation(x: number, y: number): this {
    this.translation.set(x, y);
    return this;
  }

  public setLinearVelocity(x: number, y: number): this {
    this.linearVelocity.set(x, y);
    return this;
  }

  public setRotation(angleRad: number): this {
    this.rotation = angleRad;
    return this;
  }

  public setAngularVelocity(value: number): this {
    this.angularVelocity = value;
    return this;
  }

  public setAngularDamping(_value: number): this {
    return this;
  }

  public setGravityScale(_value: number): this {
    return this;
  }

  public setLinearDamping(_value: number): this {
    return this;
  }

  public setMass(value: number): this {
    this.mass = value;
    return this;
  }

  public setEnabled(value: boolean): this {
    this.enabled = value;
    return this;
  }

  public setUserData(data: unknown): this {
    this.userData = data;
    return this;
  }

  public applyForce(_x: number, _y: number, _wake?: boolean): void {}
  public applyImpulse(_x: number, _y: number, _wake?: boolean): void {}
  public applyAngularImpulse(_value: number, _wake?: boolean): void {}
  public applyTorque(_value: number, _wake?: boolean): void {}

  public wakeUp(): void {}
  public sleep(): void {}
}

export class FakePhysicsWorld implements PhysicsWorld {
  public readonly bodies: Set<FakeRigidBody>;
  public stepCount: number;

  private readonly gravity: Vec2;
  private nextId: number;

  public constructor() {
    this.bodies = new Set();
    this.stepCount = 0;
    this.gravity = new Vec2(0, 0);
    this.nextId = 0;
  }

  public get bodyCount(): number {
    return this.bodies.size;
  }

  public step(dt: number): void {
    this.stepCount++;
    for (const body of this.bodies) {
      body.integrate(dt);
    }
  }

  public setGravity(x: number, y: number): void {
    this.gravity.set(x, y);
  }

  public getGravity(): Vec2 {
    return this.gravity;
  }

  public createRigidBody(descriptor: RigidBodyDesc): RigidBody {
    const body: FakeRigidBody = new FakeRigidBody(
      `fake-body-${this.nextId++}`,
      descriptor,
    );
    this.bodies.add(body);
    return body;
  }

  public destroyRigidBody(body: RigidBody): void {
    this.bodies.delete(body as FakeRigidBody);
  }

  public createCollider(_descriptor: ColliderDesc, _body?: RigidBody): Collider {
    throw new Error("FakePhysicsWorld.createCollider is not supported in tests.");
  }

  public destroyCollider(_collider: Collider): void {}

  public query(): PhysicsQuery {
    throw new Error("FakePhysicsWorld.query is not supported in tests.");
  }

  public clear(): void {
    this.bodies.clear();
    this.stepCount = 0;
  }
}
