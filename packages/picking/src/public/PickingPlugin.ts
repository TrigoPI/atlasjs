import { NebulaRenderer, NEBULA_RENDERER } from "@atlasjs/nebula";
import { createLogger, Logger } from "@atlasjs/utils";
import { Engine, Plugin, PRIORITY } from "@atlasjs/core";
import { INPUT, Input } from "@atlasjs/input";

import { Picker } from "./Picker";
import { PICKING } from "./Tokens";
import { DragSystem } from "./DragSystem";
import { SelectionSystem } from "./SelectionSystem";

export class PickingPlugin extends Plugin {
  private readonly logger: Logger;

  private picker: Picker | null;
  private selectionSystem: SelectionSystem | null;
  private dragSystem: DragSystem | null;

  public constructor() {
    super("picking");
    this.logger = createLogger(PickingPlugin.name);

    this.picker = null;
    this.selectionSystem = null;
    this.dragSystem = null;
  }

  public async install(engine: Engine): Promise<void> {
    this.logger.log("Installing picking plugin...");

    const renderer: NebulaRenderer =
      await engine.services.wait(NEBULA_RENDERER);

    const input: Input = await engine.services.wait(INPUT);
    const picker: Picker = new Picker(renderer.root, renderer.camera, input);

    const dragSystem: DragSystem = new DragSystem(picker, input);
    const selectionSystem: SelectionSystem = new SelectionSystem(
      picker,
      renderer,
    );

    this.picker = picker;
    this.selectionSystem = selectionSystem;
    this.dragSystem = dragSystem;

    engine.scheduler.onUpdate(() => picker.onUpdate(), {
      name: "picking:update",
      priority: PRIORITY.UPDATE_PICKING,
    });

    engine.scheduler.onUpdate(() => selectionSystem.onUpdate(), {
      name: "selection:update",
      priority: PRIORITY.UPDATE_EDITOR,
    });

    engine.services.provide(PICKING, picker);
    this.logger.log("Picking plugin installed");
    this.deferred.resolve();
  }

  public uninstall(): void {
    this.logger.log("Uninstalling picking plugin...");

    this.selectionSystem?.destroy();
    this.selectionSystem = null;

    this.dragSystem?.destroy();
    this.dragSystem = null;

    this.picker?.destroy();
    this.picker = null;
  }
}
