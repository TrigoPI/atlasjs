import { DirtyItem } from "./DrityItem";

export class DirtyQueue<T extends DirtyItem = DirtyItem> {
  private readonly q: T[];

  public constructor() {
    this.q = [];
  }

  public get length(): number {
    return this.q.length;
  }

  public pop(): T | undefined {
    const n: T | undefined = this.q.pop();
    if (n) n.markUnqueued();
    return n;
  }

  public push(item: T): void {
    if (item.isQueued()) return;
    item.markQueued();
    this.q.push(item);
  }
}
