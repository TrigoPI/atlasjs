import { ServiceToken } from "./types";

/** Two installed plugins declare that they provide the same service token. */
export class DuplicateProviderError extends Error {
  public constructor(token: ServiceToken<unknown>, a: string, b: string) {
    super(
      `Service ${String(token)} is provided by more than one plugin ("${a}" and "${b}").`,
    );
    this.name = "DuplicateProviderError";
  }
}

/** A plugin requires a service that no installed plugin provides. */
export class MissingDependencyError extends Error {
  public constructor(token: ServiceToken<unknown>, requiredBy: string) {
    super(
      `Plugin "${requiredBy}" requires service ${String(token)}, but no installed plugin provides it.`,
    );
    this.name = "MissingDependencyError";
  }
}

/** The plugin dependency graph contains a cycle. */
export class DependencyCycleError extends Error {
  public constructor(pluginIds: string[]) {
    super(`Plugin dependency cycle among: ${pluginIds.join(", ")}.`);
    this.name = "DependencyCycleError";
  }
}

/** Boot timed out waiting for one or more plugins to become ready. */
export class BootTimeoutError extends Error {
  public constructor(pendingIds: string[], timeoutMs: number) {
    super(
      `Engine boot timed out after ${timeoutMs}ms. Plugins never became ready: ${pendingIds.join(", ")}. ` +
        `Did they forget to call \`this.deferred.resolve()\`?`,
    );
    this.name = "BootTimeoutError";
  }
}
