export interface DetachedPolicy<T> {
  advance(item: T, dt: number): void;
  isExpired(item: T): boolean;
  release(item: T): void;
}

export class DetachedPool<T> {
  private readonly items: T[];
  private readonly policy: DetachedPolicy<T>;

  public constructor(policy: DetachedPolicy<T>) {
    this.items = [];
    this.policy = policy;
  }

  public push(item: T): void {
    this.items.push(item);
  }

  public advance(dt: number): void {
    const items: T[] = this.items;
    const policy: DetachedPolicy<T> = this.policy;

    for (let i: number = items.length - 1; i >= 0; i--) {
      const item: T = items[i];
      policy.advance(item, dt);

      if (!policy.isExpired(item)) {
        continue;
      }

      policy.release(item);
      items[i] = items[items.length - 1];
      items.pop();
    }
  }

  public clear(): void {
    const items: T[] = this.items;
    const policy: DetachedPolicy<T> = this.policy;

    for (let i: number = 0; i < items.length; i++) {
      policy.release(items[i]);
    }

    items.length = 0;
  }
}
