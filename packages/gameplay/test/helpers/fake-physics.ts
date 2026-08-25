import { Vec2 } from "@atlasjs/math";

import {
  CharacterController,
  CharacterControllerOptions,
  Collider,
  ColliderDesc,
  CollisionHandler,
  PhysicsQuery,
  PhysicsWorld,
  RigidBody,
  RigidBodyDesc,
  RigidBodyType,
} from "@atlasjs/inertia";

export class FakeRigidBody implements RigidBody {
  public readonly id: string;
  public readonly type: RigidBodyType;

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

export class FakeColliderWrites {
  public sensor: number;
  public collisionGroup: number;
  public collisionMask: number;
  public friction: number;
  public restitution: number;
  public density: number;
  public enabled: number;
  public userData: number;

  public constructor() {
    this.sensor = 0;
    this.collisionGroup = 0;
    this.collisionMask = 0;
    this.friction = 0;
    this.restitution = 0;
    this.density = 0;
    this.enabled = 0;
    this.userData = 0;
  }

  public get total(): number {
    return (
      this.sensor +
      this.collisionGroup +
      this.collisionMask +
      this.friction +
      this.restitution +
      this.density +
      this.enabled +
      this.userData
    );
  }
}

export class FakeCollider implements Collider {
  public readonly id: string;
  public readonly writes: FakeColliderWrites;

  private sensor: boolean;
  private enabled: boolean;
  private group: number;
  private mask: number;
  private friction: number;
  private restitution: number;
  private density: number;
  private userData: unknown;
  private readonly body: RigidBody | null;
  private readonly translation: Vec2;
  private readonly worldTranslation: Vec2;
  private rotation: number;

  public constructor(
    id: string,
    descriptor: ColliderDesc,
    body: RigidBody | null,
  ) {
    this.id = id;
    this.writes = new FakeColliderWrites();
    this.sensor = descriptor.sensor ?? false;
    this.enabled = descriptor.enabled ?? true;
    this.group = descriptor.collisionGroup ?? 0xffff;
    this.mask = descriptor.collisionMask ?? 0xffff;
    this.friction = Math.fround(descriptor.friction ?? 0);
    this.restitution = Math.fround(descriptor.restitution ?? 0);
    this.density = Math.fround(descriptor.density ?? 0);
    this.userData = descriptor.userData;
    this.body = body;
    this.translation = descriptor.translation?.clone() ?? new Vec2(0, 0);
    this.worldTranslation = new Vec2(0, 0);
    this.rotation = descriptor.rotation ?? 0;
  }

  public isSensor(): boolean {
    return this.sensor;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setSensor(value: boolean): this {
    this.writes.sensor++;
    this.sensor = value;
    return this;
  }

  public setCollisionGroup(group: number): this {
    this.writes.collisionGroup++;
    this.group = group;
    return this;
  }

  public setRestitution(value: number): this {
    this.writes.restitution++;
    this.restitution = Math.fround(value);
    return this;
  }

  public setCollisionMask(mask: number): this {
    this.writes.collisionMask++;
    this.mask = mask;
    return this;
  }

  public setFriction(value: number): this {
    this.writes.friction++;
    this.friction = Math.fround(value);
    return this;
  }

  public setDensity(value: number): this {
    this.writes.density++;
    this.density = Math.fround(value);
    return this;
  }

  public setEnabled(value: boolean): this {
    this.writes.enabled++;
    this.enabled = value;
    return this;
  }

  public getCollisionGroup(): number {
    return this.group;
  }

  public getCollisionMask(): number {
    return this.mask;
  }

  public getRestitution(): number {
    return this.restitution;
  }

  public getFriction(): number {
    return this.friction;
  }

  public getDensity(): number {
    return this.density;
  }

  public getUserData<T = unknown>(): T | undefined {
    return this.userData as T | undefined;
  }

  public setUserData(data: unknown): this {
    this.writes.userData++;
    this.userData = data;
    return this;
  }

  public getLocalTranslation(): Vec2 {
    return this.translation;
  }

  public getTranslation(): Vec2 {
    if (this.body === null) {
      return this.worldTranslation.set(this.translation.x, this.translation.y);
    }

    const origin: Vec2 = this.body.getTranslation();

    return this.worldTranslation.set(
      origin.x + this.translation.x,
      origin.y + this.translation.y,
    );
  }

  public getRotation(): number {
    return this.rotation;
  }

  public getRigidBody(): RigidBody | null {
    return this.body;
  }
}

export class FakeCharacterController implements CharacterController {
  public factor: number;
  public wallX: number | null;
  public lastCollider: Collider | null;
  public lastDesired: Vec2 | null;

  public constructor() {
    this.factor = 1;
    this.wallX = null;
    this.lastCollider = null;
    this.lastDesired = null;
  }

  public computeMovement(collider: Collider, desired: Vec2): Vec2 {
    this.lastCollider = collider;
    this.lastDesired = desired.clone();

    const allowed: Vec2 = new Vec2(
      desired.x * this.factor,
      desired.y * this.factor,
    );

    if (this.wallX === null) {
      return allowed;
    }

    const origin: Vec2 = collider.getTranslation();
    const room: number = this.wallX - origin.x;

    if (allowed.x > 0 && allowed.x > room) {
      allowed.x = room > 0 ? room : 0;
    }

    return allowed;
  }
}

export class FakePhysicsWorld implements PhysicsWorld {
  public readonly bodies: Set<FakeRigidBody>;
  public readonly colliders: Set<FakeCollider>;
  public readonly characterControllers: Set<FakeCharacterController>;
  public stepCount: number;
  public createdBodyCount: number;
  public createdColliderCount: number;

  private readonly gravity: Vec2;
  private readonly events: Array<{
    a: FakeCollider;
    b: FakeCollider;
    started: boolean;
  }>;
  private nextId: number;

  public constructor() {
    this.bodies = new Set();
    this.colliders = new Set();
    this.characterControllers = new Set();
    this.stepCount = 0;
    this.createdBodyCount = 0;
    this.createdColliderCount = 0;
    this.gravity = new Vec2(0, 0);
    this.events = [];
    this.nextId = 0;
  }

  public get bodyCount(): number {
    return this.bodies.size;
  }

  public get colliderCount(): number {
    return this.colliders.size;
  }

  public step(dt: number): void {
    this.stepCount++;
    for (const body of this.bodies) {
      body.integrate(dt);
    }
  }

  public drainCollisions(handler: CollisionHandler): void {
    for (const event of this.events) {
      handler(event.a, event.b, event.started);
    }
    this.events.length = 0;
  }

  public emitCollision(a: Collider, b: Collider, started: boolean): void {
    this.events.push({
      a: a as FakeCollider,
      b: b as FakeCollider,
      started,
    });
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
    this.createdBodyCount++;
    return body;
  }

  public destroyRigidBody(body: RigidBody): void {
    for (const collider of this.colliders) {
      if (collider.getRigidBody() === body) {
        this.colliders.delete(collider);
      }
    }

    this.bodies.delete(body as FakeRigidBody);
  }

  public createCollider(descriptor: ColliderDesc, body?: RigidBody): Collider {
    const collider: FakeCollider = new FakeCollider(
      `fake-collider-${this.nextId++}`,
      descriptor,
      body ?? null,
    );
    this.colliders.add(collider);
    this.createdColliderCount++;
    return collider;
  }

  public destroyCollider(collider: Collider): void {
    this.colliders.delete(collider as FakeCollider);
  }

  public get characterControllerCount(): number {
    return this.characterControllers.size;
  }

  public createCharacterController(
    _options?: CharacterControllerOptions,
  ): CharacterController {
    const controller: FakeCharacterController = new FakeCharacterController();
    this.characterControllers.add(controller);
    return controller;
  }

  public destroyCharacterController(controller: CharacterController): void {
    this.characterControllers.delete(controller as FakeCharacterController);
  }

  public query(): PhysicsQuery {
    throw new Error("FakePhysicsWorld.query is not supported in tests.");
  }

  public clear(): void {
    this.bodies.clear();
    this.colliders.clear();
    this.characterControllers.clear();
    this.events.length = 0;
    this.stepCount = 0;
    this.createdBodyCount = 0;
    this.createdColliderCount = 0;
  }
}
