import { ServiceToken } from "./types";

export class ServiceRegistry {
  private readonly services: Map<symbol, unknown>;

  public constructor() {
    this.services = new Map<symbol, unknown>();
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

  public has<T>(token: ServiceToken<T>): boolean {
    return this.services.has(token);
  }

  public provide<T>(token: ServiceToken<T>, value: T): void {
    this.services.set(token, value);
  }
}
