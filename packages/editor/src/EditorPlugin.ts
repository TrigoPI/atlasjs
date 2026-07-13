import { INPUT, Input } from "@atlasjs/input";
import { createLogger, Logger } from "@atlasjs/utils";
import { Engine, Plugin, StepSet } from "@atlasjs/core";
import { NebulaRenderer, NEBULA_RENDERER } from "@atlasjs/nebula";

import { Picker, PICKING } from "./picking";
import { Gizmo } from "./gizmo";
import { DragTool, ScaleTool, SelectionOverlayTool } from "./tools";

export class EditorPlugin extends Plugin {
  private readonly logger: Logger;
  private picker: Picker | null;
  private steps: StepSet | null;

  public constructor() {
    super("editor", {
      requires: [INPUT, NEBULA_RENDERER],
      provides: [PICKING],
    });
    this.logger = createLogger(EditorPlugin.name);
    this.picker = null;
    this.steps = null;
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

    const steps: StepSet = engine.scheduler.createSet("editor");
    this.steps = steps;

    steps.add("update", () => picker.onUpdate(), {
      name: "editor:picking",
      stage: "Editor",
    });

    steps.add("update", (ctx) => gizmo.onUpdate(ctx.dt), {
      name: "editor:gizmo",
      stage: "Editor",
      after: "editor:picking",
    });

    engine.services.provide(PICKING, picker);
    this.logger.log("Editor plugin installed");
    this.deferred.resolve();
  }

  public uninstall(): void {
    this.logger.log("Uninstalling editor plugin...");
    this.steps?.remove();
    this.picker?.destroy();
    this.steps = null;
    this.picker = null;
  }
}
