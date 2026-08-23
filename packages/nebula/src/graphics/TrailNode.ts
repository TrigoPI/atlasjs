import { BlendMode } from "../core";
import { Color } from "../utils";
import { Node } from "./Node";

const DEFAULT_CAPACITY: number = 64;
const MIN_CAPACITY: number = 2;

export class TrailNode extends Node {
  public time: number;
  public minVertexDistance: number;
  public startWidth: number;
  public endWidth: number;
  public startColor: Color;
  public endColor: Color;
  public blend: BlendMode;

  private xs: Float32Array;
  private ys: Float32Array;
  private ages: Float32Array;
  private head: number;
  private count: number;

  public constructor(capacity: number = DEFAULT_CAPACITY) {
    super();

    const size: number = Math.max(
      MIN_CAPACITY,
      Number.isFinite(capacity) ? capacity : MIN_CAPACITY,
    );

    this.time = 0.2;
    this.minVertexDistance = 2;
    this.startWidth = 8;
    this.endWidth = 0;
    this.startColor = new Color(1, 1, 1, 1);
    this.endColor = new Color(1, 1, 1, 0);
    this.blend = "alpha";

    this.xs = new Float32Array(size);
    this.ys = new Float32Array(size);
    this.ages = new Float32Array(size);
    this.head = 0;
    this.count = 0;
  }

  public get pointCount(): number {
    return this.count;
  }

  public get capacity(): number {
    return this.xs.length;
  }

  public setCapacity(capacity: number): this {
    const size: number = Math.max(
      MIN_CAPACITY,
      Number.isFinite(capacity) ? capacity : MIN_CAPACITY,
    );

    if (size === this.xs.length) {
      return this;
    }

    const kept: number = Math.min(this.count, size);
    const xs: Float32Array = new Float32Array(size);
    const ys: Float32Array = new Float32Array(size);
    const ages: Float32Array = new Float32Array(size);

    for (let i: number = 0; i < kept; i++) {
      const slot: number = this.slotOf(i);
      xs[i] = this.xs[slot];
      ys[i] = this.ys[slot];
      ages[i] = this.ages[slot];
    }

    this.xs = xs;
    this.ys = ys;
    this.ages = ages;
    this.head = 0;
    this.count = kept;

    return this;
  }

  public emit(x: number, y: number): void {
    if (this.count === 0) {
      this.push(x, y);
      return;
    }

    const dx: number = x - this.xs[this.head];
    const dy: number = y - this.ys[this.head];
    const threshold: number = this.minVertexDistance * this.minVertexDistance;

    if (dx * dx + dy * dy >= threshold) {
      this.push(x, y);
      return;
    }

    this.xs[this.head] = x;
    this.ys[this.head] = y;
    this.ages[this.head] = 0;
  }

  public advance(dt: number): void {
    for (let i: number = 0; i < this.count; i++) {
      this.ages[this.slotOf(i)] += dt;
    }

    while (
      this.count > 0 &&
      this.ages[this.slotOf(this.count - 1)] > this.time
    ) {
      this.count--;
    }
  }

  public clear(): this {
    this.head = 0;
    this.count = 0;
    return this;
  }

  public getPointX(index: number): number {
    return this.xs[this.slotOf(index)];
  }

  public getPointY(index: number): number {
    return this.ys[this.slotOf(index)];
  }

  public getPointAge(index: number): number {
    return this.ages[this.slotOf(index)];
  }

  private push(x: number, y: number): void {
    const size: number = this.xs.length;

    this.head = (this.head - 1 + size) % size;
    this.xs[this.head] = x;
    this.ys[this.head] = y;
    this.ages[this.head] = 0;

    if (this.count < size) {
      this.count++;
    }
  }

  private slotOf(index: number): number {
    return (this.head + index) % this.xs.length;
  }
}
