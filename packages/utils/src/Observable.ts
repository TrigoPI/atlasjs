import { TCallback } from "./types";

export class Observable<T = void> {
  private onChange: TCallback<T> | null;

  public constructor() {
    this.onChange = null;
  }

  public isBound(): boolean {
    return this.onChange !== null;
  }

  public bind(cb: TCallback<T>): void {
    this.onChange = cb;
  }

  public notifyChange(value: T): void {
    if (this.onChange) {
      this.onChange(value);
    }
  }

  public static from<T = void>(cb: TCallback<T>): Observable<T> {
    const obs: Observable<T> = new Observable<T>();
    obs.bind(cb);
    return obs;
  }
}
