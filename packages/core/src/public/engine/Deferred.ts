export class Deferred<T = void> {
  public readonly ready: Promise<T>;
  public resolve!: (value: T) => void;
  public reject!: (reason?: any) => void;

  public constructor() {
    this.ready = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}
