import { Engine, Plugin } from "@atlasjs/core";
import { createLogger, Logger } from "@atlasjs/utils";

import { DomInputBackend, BackendInput } from "../internal";
import { InputPluginOptions } from "./types";
import { INPUT } from "./Tokens";

export class InputPlugin extends Plugin {
  private readonly logger: Logger;

  private backend: DomInputBackend | null;
  private input: BackendInput | null;
  private opts: InputPluginOptions;

  public constructor(opts: InputPluginOptions) {
    super("input", 5);
    this.opts = opts;
    this.input = null;
    this.backend = null;

    this.logger = createLogger(InputPlugin.name);
  }

  public install(engine: Engine): void {
    this.logger.log("Installing input plugin...");

    const input: BackendInput = new BackendInput();
    const backend: DomInputBackend = new DomInputBackend(input);

    backend.attach(this.opts.target ?? window);

    engine.services.provide(INPUT, input);
    engine.scheduler.onEndFrame(() => input.endFrame());

    this.input = input;
    this.backend = backend;

    this.logger.log("Input plugin installed");
    this.deferred.resolve();
  }

  public uninstall(): void {
    this.backend?.detach();
    this.input?.clearAll();

    this.backend = null;
    this.input = null;
  }
}
