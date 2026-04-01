export class Bound {
  public x: number;
  public y: number;
  public width: number;
  public height: number;

  constructor(
    x: number = 0,
    y: number = 0,
    width: number = 0,
    height: number = 0,
  ) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  public isZero(): boolean {
    return this.width === 0 && this.height === 0;
  }

  public overlaps(other: Bound): boolean {
    return (
      this.x + this.width > other.x &&
      this.x < other.x + other.width &&
      this.y + this.height > other.y &&
      this.y < other.y + other.height
    );
  }

  public clone(): Bound {
    return new Bound(this.x, this.y, this.width, this.height);
  }

  public set(x: number, y: number, width: number, height: number): Bound {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    return this;
  }

  public copy(): Bound {
    return new Bound(this.x, this.y, this.width, this.height);
  }

  public static create(
    x: number = 0,
    y: number = 0,
    width: number = 0,
    height: number = 0,
  ): Bound {
    return new Bound(x, y, width, height);
  }
}
