export class Vec3 {
  public x: number;
  public y: number;
  public z: number;

  public constructor(x: number = 0, y: number = 0, z: number = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  public copyFrom(a: Vec3): Vec3 {
    this.x = a.x;
    this.y = a.y;
    this.z = a.z;
    return this;
  }

  public copyTo(out: Vec3): Vec3 {
    out.x = this.x;
    out.y = this.y;
    out.z = this.z;
    return out;
  }

  public clone(): Vec3 {
    return new Vec3(this.x, this.y, this.z);
  }

  public set(x: number = 0, y: number = 0, z: number = 0): Vec3 {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  public add(b: Vec3): Vec3 {
    this.x += b.x;
    this.y += b.y;
    this.z += b.z;
    return this;
  }

  public sub(b: Vec3): Vec3 {
    this.x -= b.x;
    this.y -= b.y;
    this.z -= b.z;
    return this;
  }

  public mult(k: number): Vec3 {
    this.x *= k;
    this.y *= k;
    this.z *= k;
    return this;
  }

  public dot(a: Vec3): number {
    return this.x * a.x + this.y * a.y + this.z * a.z;
  }

  public mag(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  public normalize(): Vec3 {
    const m: number = this.mag();
    if (m === 0) return this;
    return this.mult(1 / m);
  }

  public static from(a: Vec3): Vec3 {
    return new Vec3(a.x, a.y, a.z);
  }

  public static add(a: Vec3, b: Vec3): Vec3 {
    return new Vec3(a.x + b.x, a.y + b.y, a.z + b.z);
  }

  public static sub(a: Vec3, b: Vec3): Vec3 {
    return new Vec3(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  public static create(x: number = 0, y: number = 0, z: number = 0): Vec3 {
    return new Vec3(x, y, z);
  }
}
