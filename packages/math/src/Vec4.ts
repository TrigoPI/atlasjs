export class Vec4 {
  public x: number;
  public y: number;
  public z: number;
  public w: number;

  public constructor(
    x: number = 0,
    y: number = 0,
    z: number = 0,
    w: number = 0,
  ) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  public copyFrom(a: Vec4): Vec4 {
    this.x = a.x;
    this.y = a.y;
    this.z = a.z;
    this.w = a.w;
    return this;
  }

  public copyTo(out: Vec4): Vec4 {
    out.x = this.x;
    out.y = this.y;
    out.z = this.z;
    out.w = this.w;
    return out;
  }

  public clone(): Vec4 {
    return new Vec4(this.x, this.y, this.z, this.w);
  }

  public set(x: number = 0, y: number = 0, z: number = 0, w: number = 0): Vec4 {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  public add(b: Vec4): Vec4 {
    this.x += b.x;
    this.y += b.y;
    this.z += b.z;
    this.w += b.w;
    return this;
  }

  public sub(b: Vec4): Vec4 {
    this.x -= b.x;
    this.y -= b.y;
    this.z -= b.z;
    this.w -= b.w;
    return this;
  }

  public mult(k: number): Vec4 {
    this.x *= k;
    this.y *= k;
    this.z *= k;
    this.w *= k;
    return this;
  }

  public dot(a: Vec4): number {
    return this.x * a.x + this.y * a.y + this.z * a.z + this.w * a.w;
  }

  public static from(a: Vec4): Vec4 {
    return new Vec4(a.x, a.y, a.z, a.w);
  }

  public static create(
    x: number = 0,
    y: number = 0,
    z: number = 0,
    w: number = 0,
  ): Vec4 {
    return new Vec4(x, y, z, w);
  }
}
