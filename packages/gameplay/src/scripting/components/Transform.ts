import { Mat3, Vec2 } from "@atlasjs/math";
import { Entity } from "@atlasjs/nexus";

import { ScriptComponent } from "../core";

import {
  PhysicsBodyRef,
  RigidBody2D,
  Transform2D,
  WorldTransform2D,
} from "../../components";

export class Transform extends ScriptComponent<Transform2D> {
  public static readonly engine = Transform2D;

  public get parent(): Transform | null {
    const parentEntity: Entity | undefined = this.world.getParent(this.entity);
    return parentEntity !== undefined
      ? new Transform(this.world, parentEntity)
      : null;
  }

  public get position(): Vec2 {
    return this.resolve().position;
  }

  public get worldPosition(): Vec2 {
    return this.worldMatrix().getTranslation();
  }

  public set position(value: Vec2) {
    this.setPosition(value.x, value.y);
  }

  public get rotation(): number {
    return this.resolve().rotation;
  }

  public set rotation(value: number) {
    this.setRotation(value);
  }

  public get scale(): Vec2 {
    return this.resolve().scale;
  }

  public set scale(value: Vec2) {
    this.setScale(value.x, value.y);
  }

  public setPosition(x: number, y: number): this {
    this.resolve().position.set(x, y);

    const body: PhysicsBodyRef | undefined = this.controllingBody();
    if (body !== undefined) {
      body.body.setTranslation(x, y);
    }

    return this;
  }

  public setRotation(rotation: number): this {
    this.resolve().rotation = rotation;

    const body: PhysicsBodyRef | undefined = this.controllingBody();
    if (body !== undefined) {
      body.body.setRotation(rotation);
    }

    return this;
  }

  public setScale(x: number, y: number): this {
    this.resolve().scale.set(x, y);
    return this;
  }

  public translate(dx: number, dy: number): this {
    const position: Vec2 = this.resolve().position;
    return this.setPosition(position.x + dx, position.y + dy);
  }

  public rotate(angle: number): this {
    return this.setRotation(this.resolve().rotation + angle);
  }

  public setParent(
    parent: Transform | null,
    worldPositionStays: boolean = true,
  ): this {
    if (!worldPositionStays) {
      this.world.setParent(this.entity, parent !== null ? parent.entity : null);
      return this;
    }

    const currentWorld: Mat3 = this.worldMatrix();

    this.world.setParent(this.entity, parent !== null ? parent.entity : null);

    const parentWorld: Mat3 | null =
      parent !== null ? parent.worldMatrix() : null;

    const localMatrix: Mat3 =
      parentWorld !== null
        ? parentWorld.invert().multiply(currentWorld)
        : currentWorld;

    const transform: Transform2D = this.resolve();
    const position: Vec2 = localMatrix.getTranslation();
    const scale: Vec2 = localMatrix.getScale();

    transform.position.set(position.x, position.y);
    transform.rotation = localMatrix.getRotation();
    transform.scale.set(scale.x, scale.y);

    return this;
  }

  public getChildren(): Transform[] {
    const children: ReadonlyArray<Entity> = this.world.getChildren(this.entity);
    const result: Transform[] = [];
    for (let i: number = 0; i < children.length; i++) {
      if (this.world.hasComponent(children[i], Transform2D)) {
        result.push(new Transform(this.world, children[i]));
      }
    }
    return result;
  }

  private worldMatrix(): Mat3 {
    const wt: WorldTransform2D | undefined = this.world.getComponent(
      this.entity,
      WorldTransform2D,
    );

    return wt !== undefined
      ? wt.matrix.clone()
      : Mat3.fromTransform2D(this.resolve());
  }

  private controllingBody(): PhysicsBodyRef | undefined {
    const rigidBody: RigidBody2D | undefined = this.world.getComponent(
      this.entity,
      RigidBody2D,
    );

    if (rigidBody === undefined || rigidBody.type !== "dynamic") {
      return undefined;
    }

    return this.world.getComponent(this.entity, PhysicsBodyRef);
  }
}
