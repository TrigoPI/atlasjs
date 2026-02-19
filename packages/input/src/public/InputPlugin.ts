import { Engine, Plugin } from "@atlasjs/core";

import { DomInputBackend, BackendInput } from "../internal";
import { InputPluginOptions } from "./types";
import { INPUT } from "./Tokens";

export class InputPlugin implements Plugin {
  public readonly id: string;
  public readonly order?: number | undefined;

  private backend: DomInputBackend | null;
  private input: BackendInput | null;
  private opts: InputPluginOptions;

  public constructor(opts: InputPluginOptions) {
    this.id = "input-dom";
    this.opts = opts;
    this.order = 5;

    this.input = null;
    this.backend = null;
  }

  public install(engine: Engine): void {
    const input: BackendInput = new BackendInput();
    const backend: DomInputBackend = new DomInputBackend(input);

    backend.attach(this.opts.target ?? window);

    engine.services.provide(INPUT, input);
    engine.scheduler.onUpdate(() => input.endFrame());

    this.input = input;
    this.backend = backend;
  }

  public uninstall(): void {
    this.backend?.detach();
    this.input?.clearAll();

    this.backend = null;
    this.input = null;
  }
}
