import { Vector2D } from "../maths";

export class Transform2DComponent {
  public position: Vector2D;
  public scale: Vector2D;
  public rotation: number;

  constructor(
    position: Vector2D = new Vector2D(0, 0),
    scale: Vector2D = new Vector2D(1, 1),
    rotation: number = 0,
  ) {
    this.rotation = rotation;
    this.position = position;
    this.scale = scale;
  }

  public copy(transform: Transform2DComponent): Transform2DComponent {
    this.position.copy(transform.position);
    this.scale.copy(transform.scale);
    this.rotation = transform.rotation;
    return this;
  }

  public translate(x: number, y: number): Transform2DComponent {
    this.position.x += x;
    this.position.y += y;
    return this;
  }

  public rotate(angle: number): Transform2DComponent {
    this.rotation += angle;
    return this;
  }

  public setPosition(x: number, y: number): Transform2DComponent {
    this.position.set(x, y);
    return this;
  }

  public setScale(x: number, y: number): Transform2DComponent {
    this.scale.set(x, y);
    return this;
  }

  public setRotation(rotation: number): Transform2DComponent {
    this.rotation = rotation;
    return this;
  }
}
