import { Entity } from "../types";

export class Parent {
  public value: Entity;

  public constructor(value: Entity) {
    this.value = value;
  }
}
