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

  public static create(
    x: number = 0,
    y: number = 0,
    width: number = 0,
    height: number = 0,
  ): Bound {
    return new Bound(x, y, width, height);
  }
}
