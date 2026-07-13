import { INPUT, Input } from "@atlasjs/input";
import { createLogger, Logger } from "@atlasjs/utils";
import { Engine, Plugin, PRIORITY } from "@atlasjs/core";
import { NebulaRenderer, NEBULA_RENDERER } from "@atlasjs/nebula";

import { Picker, PICKING } from "./picking";
import { Gizmo } from "./gizmo";
import { DragTool, ScaleTool, SelectionOverlayTool } from "./tools";

export class EditorPlugin extends Plugin {
  private readonly logger: Logger;
  private picker: Picker | null;

  public constructor() {
    super("editor", {
      requires: [INPUT, NEBULA_RENDERER],
      provides: [PICKING],
    });
    this.logger = createLogger(EditorPlugin.name);
    this.picker = null;
  }

  public async install(engine: Engine): Promise<void> {
    this.logger.log("Installing editor plugin...");
    const input: Input = await engine.services.wait(INPUT);
    const renderer: NebulaRenderer =
      await engine.services.wait(NEBULA_RENDERER);

    const picker: Picker = new Picker(renderer.root, renderer.camera, input);
    const selectionOverlay: SelectionOverlayTool = new SelectionOverlayTool();
    const scaleTool: ScaleTool = new ScaleTool();
    const dragTool: DragTool = new DragTool();
    const gizmo: Gizmo = new Gizmo({
      input: input,
      picker: picker,
      renderer: renderer,
      camera: renderer.camera,
      overlay: renderer.overlay,
    });

    gizmo.register(selectionOverlay).register(scaleTool).register(dragTool);

    this.picker = picker;

    engine.scheduler.onUpdate(() => picker.onUpdate(), {
      name: "picking:update",
      priority: PRIORITY.UPDATE_PICKING,
    });

    engine.scheduler.onUpdate((dt: number) => gizmo.onUpdate(dt), {
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
    this.picker?.destroy();
    this.picker = null;
  }
}
