import { describe, expect, it } from "vitest";
import { Engine, Plugin } from "@atlasjs/core";
import type { StepHandle } from "@atlasjs/core";
import type { ServiceToken } from "@atlasjs/core";
import {
  ComponentRegistry,
  NEXUS,
  NexusPlugin,
  NexusWorld,
} from "@atlasjs/nexus";
import { NEBULA_RENDERER, SceneGraph } from "@atlasjs/nebula";
import type { Node } from "@atlasjs/nebula";

import { GIZMOS } from "../src/tokens";
import { Gizmos } from "../src/Gizmos";
import { GizmoPlugin } from "../src/GizmoPlugin";
import { ColliderGizmo } from "../src/components/ColliderGizmo";
import { PivotGizmo } from "../src/components/PivotGizmo";

const FIXED: number = 0.1;

class Provide extends Plugin {
  public constructor(
    id: string,
    private readonly token: ServiceToken<unknown>,
    private readonly value: unknown,
  ) {
    super(id, { provides: [token] });
  }

  public install(engine: Engine): void {
    engine.services.provide(this.token, this.value);
    this.deferred.resolve();
  }

  public uninstall(): void {}
}

async function boot(showColliders: boolean = false): Promise<{
  engine: Engine;
  world: NexusWorld;
  scene: SceneGraph;
  gizmos: Gizmos;
  frame: () => void;
}> {
  let onTick: ((dt: number) => void) | null = null;
  const scene: SceneGraph = new SceneGraph();

  const engine: Engine = new Engine({
    fixedDelta: FIXED,
    maxSubSteps: 64,
    loop: (cb) => {
      onTick = cb;
      return () => {};
    },
  });

  engine.use(new NexusPlugin());
  engine.use(
    new Provide("stub-nebula", NEBULA_RENDERER, {
      createSampler: () => ({}),
      scene,
    }),
  );
  engine.use(new GizmoPlugin({ showColliders }));

  await engine.start();

  return {
    engine,
    world: engine.services.get<NexusWorld>(NEXUS),
    scene,
    gizmos: engine.services.get<Gizmos>(GIZMOS),
    frame: (): void => onTick!(FIXED * 1.5),
  };
}

describe("GizmoPlugin", () => {
  it("fournit le service GIZMOS", async () => {
    const { gizmos } = await boot();
    expect(gizmos).toBeInstanceOf(Gizmos);
  });

  it("propage les options d'install dans le settings", async () => {
    const { gizmos } = await boot(true);
    expect(gizmos.settings.showColliders).toBe(true);
    expect(gizmos.settings.showPivots).toBe(false);
    expect(gizmos.settings.pivotRadius).toBe(2);
    expect(gizmos.settings.borderWidth).toBe(1);
  });

  it("définit les deux composants sur le monde à l'install", async () => {
    const registry: ComponentRegistry = new ComponentRegistry();

    expect(registry.has(ColliderGizmo)).toBe(false);
    expect(registry.has(PivotGizmo)).toBe(false);

    let onTick: ((dt: number) => void) | null = null;
    const scene: SceneGraph = new SceneGraph();

    const engine: Engine = new Engine({
      fixedDelta: FIXED,
      maxSubSteps: 64,
      loop: (cb) => {
        onTick = cb;
        return () => {};
      },
    });

    engine.use(new Provide("stub-nexus", NEXUS, new NexusWorld(registry)));
    engine.use(
      new Provide("stub-nebula", NEBULA_RENDERER, {
        createSampler: () => ({}),
        scene,
      }),
    );
    engine.use(new GizmoPlugin());

    await engine.start();

    expect(registry.has(ColliderGizmo)).toBe(true);
    expect(registry.has(PivotGizmo)).toBe(true);
    expect(onTick).not.toBeNull();
  });

  it("masque les nœuds non réutilisés dans la même frame, sans latence", async () => {
    const { engine, scene, gizmos, frame } = await boot();

    let count: number = 3;

    const handle: StepHandle = engine.scheduler.render.add(
      () => {
        for (let i: number = 0; i < count; i += 1) {
          gizmos.drawRect(0, 0, 10, 10, 0);
        }
      },
      { name: "test:producer", stage: "PreRender", before: "gizmos:flush" },
    );

    frame();

    expect(scene.root.getChildren().length).toBe(3);
    expect(scene.root.getChildren().every((n: Node) => n.visible)).toBe(true);

    count = 1;
    frame();

    const children: ReadonlyArray<Node> = scene.root.getChildren();
    expect(children.length).toBe(3);
    expect(children[0].visible).toBe(true);
    expect(children[1].visible).toBe(false);
    expect(children[2].visible).toBe(false);

    handle.remove();
  });

  it("uninstall retire les nœuds du pool de la scène", async () => {
    const { engine, gizmos, scene } = await boot();

    gizmos.drawRect(0, 0, 10, 10, 0);
    gizmos.drawCircle(0, 0, 5);
    expect(scene.root.getChildren().length).toBe(2);

    engine.stop();

    expect(scene.root.getChildren().length).toBe(0);
  });
});
