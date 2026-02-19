import { DirtyCallback } from "./types";
import { Observable } from "../../internal";
import { ObservableVec2, Vec2Like } from "../vec2";
import { Transform2DLike } from "./Transform2DLike";

export class ObservableTransform2D extends Transform2DLike<ObservableVec2> {
  private readonly observer: Observable<DirtyCallback>;

  public constructor(
    position: ObservableVec2 = new ObservableVec2(),
    scale: ObservableVec2 = new ObservableVec2(1, 1),
    rotation: number = 0,
  ) {
    super(position, scale, rotation);
    this.observer = new Observable<DirtyCallback>();
    this._scale.bind(() => this.observer.notifyChange());
    this._position.bind(() => this.observer.notifyChange());
  }

  public get position(): Vec2Like {
    return this._position;
  }

  public get scale(): Vec2Like {
    return this._scale;
  }

  public set rotation(value: number) {
    if (value === this._rotation) return;
    this._rotation = value;
    this.observer.notifyChange();
  }

  public get rotation(): number {
    return this._rotation;
  }

  public setPosition(x: number, y: number): Transform2DLike {
    this.position.set(x, y);
    return this;
  }

  public setScale(x: number, y: number): Transform2DLike {
    this.scale.set(x, y);
    return this;
  }

  public setRotation(r: number): Transform2DLike {
    this._rotation = r;
    this.observer.notifyChange();
    return this;
  }

  public translate(translation: Vec2Like): Transform2DLike {
    this.position.add(translation);
    return this;
  }

  public rotate(dr: number): Transform2DLike {
    if (dr === 0) return this;
    this._rotation += dr;
    this.observer.notifyChange();
    return this;
  }

  public bind(callback: DirtyCallback): void {
    if (this.observer.isBound()) {
      throw new Error(
        "Transform2D: Only one callback can be bound to a transform",
      );
    }

    this.observer.bind(callback);
  }

  public static create(
    position: Vec2Like = new ObservableVec2(),
    scale: Vec2Like = new ObservableVec2(1, 1),
    rotation: number = 0,
  ): ObservableTransform2D {
    const p: ObservableVec2 = ObservableVec2.create(position.x, position.y);
    const s: ObservableVec2 = ObservableVec2.create(scale.x, scale.y);
    return new ObservableTransform2D(p, s, rotation);
  }
}
