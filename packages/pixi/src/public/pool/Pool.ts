import { Container } from "pixi.js";

export abstract class Pool<T extends Container> {
  private readonly parent: Container;
  private readonly pool: T[];

  private used: number;

  public constructor(parent: Container) {
    this.parent = parent;
    this.used = 0;
    this.pool = [];
  }

  protected abstract createNew(): T;
  protected abstract afterVisible(instance: T): void;

  public acquire(): T {
    let s: T;

    if (this.used < this.pool.length) {
      s = this.pool[this.used];
    } else {
      s = this.createNew();
      this.pool.push(s);
      this.parent.addChild(s);
    }

    s.visible = true;
    this.afterVisible(s);

    this.used++;
    return s;
  }

  public beginFrame(): void {
    this.used = 0;
  }

  public endFrame(): void {
    for (let i = this.used; i < this.pool.length; i++) {
      this.pool[i].visible = false;
    }
  }
}
