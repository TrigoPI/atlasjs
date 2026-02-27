export class Box2 {
  public width: number;
  public height: number;

  public constructor(width: number = 0, height: number = 0) {
    this.width = width;
    this.height = height;
  }

  public copy(): Box2 {
    return new Box2(this.width, this.height);
  }

  public static create(width: number = 0, height: number = 0): Box2 {
    return new Box2(width, height);
  }
}
