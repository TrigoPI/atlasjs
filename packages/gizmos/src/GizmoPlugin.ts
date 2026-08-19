import { Engine, Plugin, StepHandle } from "@atlasjs/core";
import { createLogger, Logger } from "@atlasjs/utils";
import { NEXUS, NexusWorld } from "@atlasjs/nexus";
import { NEBULA_RENDERER, NebulaRenderer } from "@atlasjs/nebula";
import { registerSystem } from "@atlasjs/gameplay";

import { GIZMOS } from "./tokens";
import { Gizmos } from "./Gizmos";
import { GizmoNodePool } from "./GizmoNodePool";
import { GizmoPluginOptions, GizmoSettings } from "./GizmoSettings";
import { ColliderGizmo } from "./components/ColliderGizmo";
import { PivotGizmo } from "./components/PivotGizmo";
import { ColliderGizmoSystem } from "./systems/ColliderGizmoSystem";
import { PivotGizmoSystem } from "./systems/PivotGizmoSystem";

export class GizmoPlugin extends Plugin {
  private readonly logger: Logger;
  private readonly options: GizmoPluginOptions;
  private handles: StepHandle[];
  private pool: GizmoNodePool | null;

  public constructor(options: GizmoPluginOptions = {}) {
    super("gizmo-plugin", {
      requires: [NEXUS, NEBULA_RENDERER],
      provides: [GIZMOS],
    });

    this.logger = createLogger(GizmoPlugin.name);
    this.options = options;
    this.handles = [];
    this.pool = null;
  }

  // prettier-ignore
  public async install(engine: Engine): Promise<void> {
    const world: NexusWorld = await engine.services.wait(NEXUS);
    const nebula: NebulaRenderer = await engine.services.wait(NEBULA_RENDERER);

    const settings: GizmoSettings = new GizmoSettings(this.options);
    const pool: GizmoNodePool = new GizmoNodePool(nebula);
    const gizmos: Gizmos = new Gizmos(pool, settings);

    this.pool = pool;

    world.defineComponent(ColliderGizmo).defineComponent(PivotGizmo);

    const colliderSystem: ColliderGizmoSystem = new ColliderGizmoSystem(gizmos);

    this.handles.push(
      registerSystem(engine.scheduler.render, world, colliderSystem, {
        name: "gizmos:collider",
        stage: "PreRender",
        before: "gizmos:flush",
      }),
    );

    const pivotSystem: PivotGizmoSystem = new PivotGizmoSystem(gizmos);

    this.handles.push(
      registerSystem(engine.scheduler.render, world, pivotSystem, {
        name: "gizmos:pivot",
        stage: "PreRender",
        before: "gizmos:flush",
      }),
    );

    this.handles.push(
      engine.scheduler.render.add(() => {
          pool.hideUnused();
          pool.reset();
        },
        {
          name: "gizmos:flush",
          stage: "PreRender",
        },
      ),
    );

    engine.services.provide(GIZMOS, gizmos);
    this.logger.log("GizmoPlugin installed.");
    this.deferred.resolve();
  }

  public uninstall(): void {
    for (const handle of this.handles) {
      handle.remove();
    }

    this.handles = [];
    this.pool?.dispose();
    this.pool = null;
  }
}
