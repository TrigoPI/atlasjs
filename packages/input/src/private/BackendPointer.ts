import { Vec2 } from "@atlasjs/math";
import { Pointer } from "../public";

export class BackendPointer implements Pointer {
  private _position: Vec2;
  private _delta: Vec2;

  private _down: boolean;
  private _pressed: boolean;
  private _released: boolean;

  private _wheelDelta: number;

  public constructor() {
    this._position = new Vec2();
    this._delta = new Vec2();

    this._down = false;
    this._pressed = false;
    this._released = false;

    this._wheelDelta = 0;
  }

  public get position(): Readonly<Vec2> {
    return this._position;
  }

  public get delta(): Readonly<Vec2> {
    return this._delta;
  }

  public get down(): boolean {
    return this._down;
  }

  public get pressed(): boolean {
    return this._pressed;
  }

  public get released(): boolean {
    return this._released;
  }

  public get wheelDelta(): number {
    return this._wheelDelta;
  }

  public move(x: number, y: number): void {
    this._delta.x += x - this._position.x;
    this._delta.y += y - this._position.y;

    this._position.x = x;
    this._position.y = y;
  }

  public setDown(down: boolean): void {
    if (down && !this._down) {
      this._pressed = true;
    }

    if (!down && this._down) {
      this._released = true;
    }

    this._down = down;
  }

  public wheel(dy: number): void {
    this._wheelDelta += dy;
  }

  public clear(): void {
    this._delta.x = 0;
    this._delta.y = 0;
    this._pressed = false;
    this._released = false;
    this._wheelDelta = 0;
  }

  public clearAll(): void {
    this._position.set(0, 0);
    this._delta.set(0, 0);

    this._down = false;
    this._pressed = false;
    this._released = false;
    this._wheelDelta = 0;
  }
}
