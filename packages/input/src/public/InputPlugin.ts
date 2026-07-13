import { Engine, Plugin, StepHandle } from "@atlasjs/core";
import { createLogger, Logger } from "@atlasjs/utils";

import { DomInputBackend, BackendInput } from "../private";
import { InputPluginOptions } from "./types";
import { INPUT } from "./Tokens";

export class InputPlugin extends Plugin {
  private readonly logger: Logger;

  private backend: DomInputBackend | null;
  private input: BackendInput | null;
  private endFrameStep: StepHandle | null;
  private opts: InputPluginOptions;

  public constructor(opts: InputPluginOptions) {
    super("input", { provides: [INPUT] });
    this.opts = opts;
    this.input = null;
    this.backend = null;
    this.endFrameStep = null;

    this.logger = createLogger(InputPlugin.name);
  }

  public install(engine: Engine): void {
    const input: BackendInput = new BackendInput();
    const backend: DomInputBackend = new DomInputBackend(input);

    this.input = input;
    this.backend = backend;

    backend.attach(this.opts.target ?? window);

    this.endFrameStep = engine.scheduler.update.add(() => input.endFrame(), {
      name: "input:end-frame",
      stage: "Late",
    });

    engine.services.provide(INPUT, input);

    this.logger.log("Input plugin installed");
    this.deferred.resolve();
  }

  public uninstall(): void {
    this.endFrameStep?.remove();
    this.backend?.detach();
    this.input?.clearAll();

    this.endFrameStep = null;
    this.backend = null;
    this.input = null;
  }
}
