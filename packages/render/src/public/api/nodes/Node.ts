import { INodeDriver } from "../../../backend";

import { DirtyObserver } from "./types";
import { RendererLike } from "./RendererLike";

import {
  ObservableTransform2D,
  Transform2DLike,
  Vec2Like,
} from "@atlasjs/math";

export class Node<TDriver extends INodeDriver = INodeDriver> {
  public readonly id: string;
  public readonly driver: TDriver;

  protected readonly renderer: RendererLike;
  protected readonly _transform: ObservableTransform2D;

  private dead: boolean;
  private queued: boolean;
  private transformDirty: boolean;
  private markDirty: DirtyObserver | null;

  constructor(
    driver: TDriver,
    renderer: RendererLike,
    id: string = crypto.randomUUID(),
  ) {
    this.id = id;
    this.driver = driver;
    this.renderer = renderer;

    this.markDirty = null;

    this.dead = false;
    this.transformDirty = true;
    this.queued = false;

    this._transform = ObservableTransform2D.create();

    this._transform.bind(() => {
      this.transformDirty = true;
      this.markDirty?.();
    });
  }

  public get transform(): Transform2DLike {
    return this._transform;
  }

  public get rotation(): number {
    return this.transform.rotation;
  }

  public get scale(): Vec2Like {
    return this.transform.scale;
  }

  public get position(): Vec2Like {
    return this.transform.position;
  }

  public isQueued(): boolean {
    return this.queued;
  }

  public isTransformDirty(): boolean {
    return this.transformDirty;
  }

  public setTransform(t: Transform2DLike): Node {
    this.assertAlive();
    this._transform.setPosition(t.position.x, t.position.y);
    this._transform.setScale(t.scale.x, t.scale.y);
    this._transform.setRotation(t.rotation);
    return this;
  }

  public setVisible(v: boolean): Node {
    this.assertAlive();
    this.driver.setVisible(v);
    this.renderer.events.emit("node:visibleChanged", {
      id: this.id,
      visible: v,
    });

    return this;
  }

  public setAlpha(a: number): Node {
    this.assertAlive();
    this.driver.setAlpha(a);
    this.renderer.events.emit("node:alphaChanged", {
      id: this.id,
      alpha: a,
    });

    return this;
  }

  public destroy(): void {
    this.driver.destroy();
    this.renderer.events.emit("node:destroyed", {
      id: this.id,
    });
  }

  public markQueued(): void {
    this.queued = true;
  }

  public markUnqueued(): void {
    this.queued = false;
  }

  public flushTransform(): void {
    this.driver.setTransform(this._transform);
    this.transformDirty = false;
  }

  public onDirty(callback: DirtyObserver): void {
    this.markDirty = callback;
  }

  private assertAlive() {
    if (this.dead) {
      throw new Error(`Node "${this.id}" is destroyed`);
    }
  }
}
