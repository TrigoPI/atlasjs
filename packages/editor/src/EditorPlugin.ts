import { INPUT, Input } from "@atlasjs/input";
import { createLogger, Logger } from "@atlasjs/utils";
import { Engine, Plugin, PRIORITY } from "@atlasjs/core";
import { NebulaRenderer, NEBULA_RENDERER } from "@atlasjs/nebula";

import { Picker, PICKING } from "./picking";
import { SelectionSystem } from "./selection";
import { DragSystem } from "./drag";
import { Gizmo } from "./gizmo";

export class EditorPlugin extends Plugin {
  private readonly logger: Logger;

  private picker: Picker | null;
  private selectionSystem: SelectionSystem | null;
  private dragSystem: DragSystem | null;

  public constructor() {
    super("editor");
    this.logger = createLogger(EditorPlugin.name);

    this.picker = null;
    this.selectionSystem = null;
    this.dragSystem = null;
  }

  public async install(engine: Engine): Promise<void> {
    this.logger.log("Installing editor plugin...");

    const renderer: NebulaRenderer =
      await engine.services.wait(NEBULA_RENDERER);

    const input: Input = await engine.services.wait(INPUT);
    const picker: Picker = new Picker(renderer.root, renderer.camera, input);
    const dragSystem: DragSystem = new DragSystem(picker, input);

    const selectionSystem: SelectionSystem = new SelectionSystem(
      picker,
      renderer,
    );

    const gizmo: Gizmo = new Gizmo(
      renderer,
      selectionSystem,
      renderer.camera,
      input,
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
      id: 0,
    });

    engine.scheduler.onUpdate(() => gizmo.onUpdate(), {
      name: "gizmo:update",
      priority: PRIORITY.UPDATE_EDITOR,
      id: 1,
    });

    engine.services.provide(PICKING, picker);
    this.logger.log("Editor plugin installed");
    this.deferred.resolve();
  }

  public uninstall(): void {
    this.logger.log("Uninstalling editor plugin...");

    this.selectionSystem?.destroy();
    this.selectionSystem = null;

    this.dragSystem?.destroy();
    this.dragSystem = null;

    this.picker?.destroy();
    this.picker = null;
  }
}
