import { Keyboard } from "../public";

export class BackendKeyboard implements Keyboard {
  private downSet: Set<string>;
  private pressedSet: Set<string>;
  private releasedSet: Set<string>;

  public constructor() {
    this.downSet = new Set<string>();
    this.pressedSet = new Set<string>();
    this.releasedSet = new Set<string>();
  }

  public down(code: string): boolean {
    return this.downSet.has(code);
  }

  public pressed(code: string): boolean {
    return this.pressedSet.has(code);
  }

  public released(code: string): boolean {
    return this.releasedSet.has(code);
  }

  public setUp(code: string): void {
    if (this.downSet.has(code)) {
      this.releasedSet.add(code);
    }

    this.downSet.delete(code);
  }

  public setDown(code: string): void {
    if (!this.downSet.has(code)) {
      this.pressedSet.add(code);
    }

    this.downSet.add(code);
  }

  public endFrame(): void {
    this.pressedSet.clear();
    this.releasedSet.clear();
  }

  public clearAll(): void {
    this.downSet.clear();
    this.pressedSet.clear();
    this.releasedSet.clear();
  }
}
