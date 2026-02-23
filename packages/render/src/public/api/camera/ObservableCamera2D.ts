import { ObservableVec2, Box2, Vec2, Mat2, Vec2Like } from "@atlasjs/math";
import { Observable } from "@atlasjs/utils";

import { Camera2D } from "./Camera2D";
import { ICameraDriver } from "../../../backend";

export class ObservableCamera2D<
  T extends ICameraDriver = ICameraDriver,
> extends Camera2D {
  protected _position: ObservableVec2;
  protected _viewport: Box2;
  protected _zoom: number;
  protected _rotation: number;

  private readonly driver: T;
  private readonly positionObserver: Observable;

  private dirtyDriver: boolean;
  private dirtyView: boolean;
  private dirtyInv: boolean;

  public constructor(driver: T) {
    super();
    this.driver = driver;

    this.dirtyDriver = true;
    this.dirtyView = true;
    this.dirtyInv = true;

    this._rotation = 0;
    this._zoom = 1;

    this.positionObserver = new Observable();
    this._viewport = new Box2(1, 1);
    this._position = new ObservableVec2(this.positionObserver, 0, 0);

    this.positionObserver.bind(() => this.markDirty());
  }

  public get zoom(): number {
    return this._zoom;
  }

  public set zoom(v: number) {
    const z = Math.max(0.0001, v);
    if (z === this._zoom) return;
    this._zoom = z;
    this.markDirty();
  }

  public get rotation(): number {
    return this._rotation;
  }

  public set rotation(v: number) {
    if (v === this._rotation) return;
    this._rotation = v;
    this.markDirty();
  }

  public get position(): ObservableVec2 {
    return this._position;
  }

  public set position(v: Vec2Like) {
    this._position.set(v.x, v.y);
  }

  public isDirty(): boolean {
    return this.dirtyDriver;
  }

  public viewMatrix(): Mat2 {
    this.ensureView();
    return this.view;
  }

  public invViewMatrix(): Mat2 {
    this.ensureInv();
    return this.invView;
  }

  public screenToWorld(screen: Vec2Like): Vec2 {
    return this.invViewMatrix().multVec2(screen);
  }

  public worldToScreen(world: Vec2Like): Vec2 {
    return this.viewMatrix().multVec2(world);
  }

  public setViewportSize(width: number, height: number): void {
    if (width === this._viewport.width && height === this._viewport.height)
      return;
    this._viewport.width = width;
    this._viewport.height = height;
    this.markDirty();
  }

  public flush(): void {
    if (!this.dirtyDriver) return;

    this.driver.setView({
      zoom: this.zoom,
      position: this._position,
      rotation: this._rotation,
      viewport: this._viewport,
    });

    this.dirtyDriver = false;
  }

  private ensureView(): void {
    if (!this.dirtyView) return;
    this.dirtyView = false;

    const cx: number = this._viewport.width * 0.5;
    const cy: number = this._viewport.height * 0.5;

    const z: number = this._zoom;
    const r: number = this._rotation;

    const cos: number = r === 0 ? 1 : Math.cos(r);
    const sin: number = r === 0 ? 0 : Math.sin(r);

    const a: number = cos * z;
    const b: number = sin * z;
    const c: number = -sin * z;
    const d: number = cos * z;

    const px: number = this.position.x;
    const py: number = this.position.y;

    this.view.a = a;
    this.view.b = b;
    this.view.c = c;
    this.view.d = d;
    this.view.tx = cx - (a * px + c * py);
    this.view.ty = cy - (b * px + d * py);
  }

  private ensureInv(): void {
    this.ensureView();
    if (!this.dirtyInv) return;
    this.dirtyInv = false;
    this.invView.copyFrom(this.view).invert();
  }

  private markDirty(): void {
    this.dirtyDriver = true;
    this.dirtyView = true;
    this.dirtyInv = true;
  }
}
