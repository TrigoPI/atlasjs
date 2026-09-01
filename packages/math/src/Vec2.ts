import { atan2, cos, PI_2, sin } from "./Math";

function normalizeAngle(r: number): number {
  if (r >= 0) return r < PI_2 ? r : r % PI_2;
  const n: number = (r % PI_2) + PI_2;
  return n < PI_2 ? n : 0;
}

export class Vec2 {
  public x: number;
  public y: number;

  public constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  public copyFrom(a: Vec2): Vec2 {
    this.x = a.x;
    this.y = a.y;
    return this;
  }

  public copyTo(out: Vec2): Vec2 {
    out.x = this.x;
    out.y = this.y;
    return out;
  }

  public clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  public set(x: number = 0, y: number = 0): Vec2 {
    this.x = x;
    this.y = y;
    return this;
  }

  public add(b: Vec2): Vec2 {
    this.x += b.x;
    this.y += b.y;
    return this;
  }

  public sub(b: Vec2): Vec2 {
    this.x -= b.x;
    this.y -= b.y;
    return this;
  }

  public mult(k: number): Vec2 {
    this.x *= k;
    this.y *= k;
    return this;
  }

  public normalize(): Vec2 {
    const m: number = this.mag();
    if (m === 0) return this;
    return this.mult(1 / m);
  }

  public clamp(max: number): Vec2 {
    if (this.mag() > max) {
      this.normalize().mult(max);
    }

    return this;
  }

  public moveTowards(target: Vec2, maxDelta: number): Vec2 {
    if (maxDelta <= 0) return this;

    const dx: number = target.x - this.x;
    const dy: number = target.y - this.y;
    const dist: number = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0) return this;

    if (dist <= maxDelta) {
      this.x = target.x;
      this.y = target.y;
      return this;
    }

    const k: number = maxDelta / dist;
    this.x += dx * k;
    this.y += dy * k;
    return this;
  }

  /**
   * Framerate-dependent: `lerp(target, k * dt)` smooths faster as the
   * framerate rises. Framerate-independent smoothing needs `1 - exp(-k * dt)`.
   */
  public lerp(target: Vec2, t: number): Vec2 {
    if (t <= 0) return this;

    if (t >= 1) {
      this.x = target.x;
      this.y = target.y;
      return this;
    }

    this.x += (target.x - this.x) * t;
    this.y += (target.y - this.y) * t;
    return this;
  }

  public swap(): Vec2 {
    const temp: number = this.x;
    this.x = this.y;
    this.y = temp;
    return this;
  }

  public dot(a: Vec2): number {
    return this.x * a.x + this.y * a.y;
  }

  public mag(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  public angle(): number {
    return normalizeAngle(atan2(this.y, this.x));
  }

  public static from(a: Vec2): Vec2 {
    return new Vec2(a.x, a.y);
  }

  public static add(a: Vec2, b: Vec2): Vec2 {
    return new Vec2(a.x + b.x, a.y + b.y);
  }

  public static sub(a: Vec2, b: Vec2): Vec2 {
    return new Vec2(a.x - b.x, a.y - b.y);
  }

  public static angle(a: Vec2, b: Vec2): number {
    return normalizeAngle(atan2(b.y - a.y, b.x - a.x));
  }

  public static fromAngle(r: number): Vec2 {
    const x: number = cos(r);
    const y: number = sin(r);
    return new Vec2(x, y);
  }

  public static subTo(a: Vec2, b: Vec2, out: Vec2): Vec2 {
    out.set(a.x - b.x, a.y - b.y);
    return out;
  }

  public static addTo(a: Vec2, b: Vec2, out: Vec2): Vec2 {
    out.set(a.x + b.x, a.y + b.y);
    return out;
  }

  public static create(x: number = 0, y: number = 0): Vec2 {
    return new Vec2(x, y);
  }

  public static zero(): Vec2 {
    return new Vec2(0, 0);
  }
}
