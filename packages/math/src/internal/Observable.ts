export class Observable<T extends () => void> {
  private onChange: T | null;

  public constructor() {
    this.onChange = null;
  }

  public isBound(): boolean {
    return this.onChange !== null;
  }

  public bind(cb: T): void {
    this.onChange = cb;
  }

  public notifyChange(): void {
    if (this.onChange) {
      this.onChange();
    }
  }
}
