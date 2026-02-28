import { Node } from "../nodes";

export class Overlay {
  public readonly _nodes: Node[];
  private dirty: boolean;

  public constructor() {
    this._nodes = [];
    this.dirty = true;
  }

  public get nodes(): ReadonlyArray<Node> {
    return this._nodes;
  }

  public add(n: Node): void {
    if (this._nodes.includes(n)) return;
    this._nodes.push(n);
    this.dirty = true;
  }

  public remove(n: Node): void {
    const i = this._nodes.indexOf(n);
    if (i === -1) return;
    this._nodes.splice(i, 1);
    this.dirty = true;
  }

  public clear(): void {
    this._nodes.length = 0;
    this.dirty = true;
  }

  public markDirty(): void {
    this.dirty = true;
  }

  public consumeDirty(): boolean {
    const d = this.dirty;
    this.dirty = false;
    return d;
  }
}
