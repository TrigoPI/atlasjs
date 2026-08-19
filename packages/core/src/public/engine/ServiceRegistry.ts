import { createLogger, Logger } from "@atlasjs/utils";
import { Deferred } from "./Deferred";
import { ServiceToken } from "./types";

export class ServiceRegistry {
  private readonly logger: Logger;
  private readonly services: Map<symbol, unknown>;
  private readonly waiters: Map<symbol, Deferred<any>[]>;

  public constructor() {
    this.logger = createLogger(ServiceRegistry.name);
    this.services = new Map<symbol, unknown>();
    this.waiters = new Map<symbol, Deferred<any>[]>();
  }

  public static createToken<T>(description: string): ServiceToken<T> {
    return Symbol(description) as ServiceToken<T>;
  }

  public get<T>(token: ServiceToken<T>): T {
    const v: unknown = this.services.get(token);

    if (v === undefined) {
      throw new Error(`Service not found: ${String(token)}`);
    }

    return v as T;
  }

  public wait<T>(token: ServiceToken<T>): Promise<T> {
    if (this.services.has(token)) {
      const service: unknown = this.services.get(token);
      return Promise.resolve(service as T);
    }

    const deferred: Deferred<T> = new Deferred<T>();
    const waiting: Deferred<any>[] | undefined = this.waiters.get(token);

    if (waiting === undefined) {
      this.waiters.set(token, [deferred]);
    } else {
      waiting.push(deferred);
    }

    return deferred.ready;
  }

  public has<T>(token: ServiceToken<T>): boolean {
    return this.services.has(token);
  }

  public provide<T>(token: ServiceToken<T>, value: T): void {
    this.logger.log(`Providing service: ${String(token)}`);
    this.services.set(token, value);
    this.resolveWaiting(token, value);
  }

  private resolveWaiting<T>(token: ServiceToken<T>, value: T): void {
    const waiting: Deferred<unknown>[] | undefined = this.waiters.get(token);

    if (waiting === undefined) {
      return;
    }

    this.waiters.delete(token);

    for (const deferred of waiting) {
      deferred.resolve(value);
    }
  }
}
