import { Observable } from "@atlasjs/utils";
import { Mat2, ObservalbeVec2, Vec2, Vec2Like } from "@atlasjs/math";
import { ViewState } from "@atlasjs/renderer";

export class Camera2D {
  public readonly position: ObservalbeVec2;
  public readonly viewport: ObservalbeVec2;

  private _zoom: number;
  private _rotation: number;

  private dirty: boolean;
  private view: Mat2;
  private invView: Mat2;

  private readonly dirtyObserver: Observable;

  public constructor() {
    this._zoom = 1;
    this._rotation = 0;
    this.dirty = true;

    this.dirtyObserver = Observable.from(() => this.markDirty());
    this.viewport = ObservalbeVec2.create(this.dirtyObserver);
    this.position = ObservalbeVec2.create(this.dirtyObserver);

    this.view = Mat2.identity();
    this.invView = Mat2.identity();
  }

  public get rotation(): number {
    return this._rotation;
  }

  public set rotation(value: number) {
    this._rotation = value;
    this.markDirty();
  }

  public get zoom(): number {
    return this._zoom;
  }

  public set zoom(value: number) {
    this._zoom = value;
    this.markDirty();
  }

  public screenToWorld(p: Vec2Like): Vec2 {
    const out: Vec2 = new Vec2();
    this.screenToWorldTo(p, out);
    return out;
  }

  public worldToScreen(world: Vec2): Vec2 {
    const out: Vec2 = new Vec2();
    this.worldToScreenTo(world, out);
    return out;
  }

  public getViewState(): ViewState {
    this.ensure();
    return { view: this.view, invView: this.invView };
  }

  public markDirty(): void {
    this.dirty = true;
  }

  public screenToWorldTo(screen: Vec2, out: Vec2Like): void {
    this.ensure();
    this.invView.multVec2To(screen, out);
  }

  public worldToScreenTo(world: Vec2, out: Vec2Like): void {
    this.ensure();
    this.view.multVec2To(world, out);
  }

  public setViewportSize(w: number, h: number): void {
    if (this.viewport.x === w && this.viewport.y === h) return;
    this.viewport.x = w;
    this.viewport.y = h;
    this.dirty = true;
  }

  private ensure(): void {
    if (!this.dirty) return;
    this.dirty = false;

    const cx: number = this.viewport.x * 0.5;
    const cy: number = this.viewport.y * 0.5;

    const z: number = Math.max(0.0001, this.zoom);
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

    this.invView.copyFrom(this.view).invert();
  }
}
