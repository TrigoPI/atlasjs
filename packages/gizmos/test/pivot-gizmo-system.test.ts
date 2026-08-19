import { describe, expect, it } from "vitest";
import { Transform2D as MathTransform2D } from "@atlasjs/math";
import { Color, SceneGraph } from "@atlasjs/nebula";
import type { CircleNode, NebulaRenderer } from "@atlasjs/nebula";
import { NexusWorld } from "@atlasjs/nexus";
import type { Entity } from "@atlasjs/nexus";
import { WorldTransform2D } from "@atlasjs/gameplay";

import { GizmoNodePool } from "../src/GizmoNodePool";
import { GizmoSettings } from "../src/GizmoSettings";
import { Gizmos } from "../src/Gizmos";
import { PivotGizmo } from "../src/components/PivotGizmo";
import { PivotGizmoSystem } from "../src/systems/PivotGizmoSystem";

interface Ctx {
  world: NexusWorld;
  scene: SceneGraph;
  gizmos: Gizmos;
  system: PivotGizmoSystem;
}

function setup(): Ctx {
  const world: NexusWorld = new NexusWorld();
  world.defineComponent(WorldTransform2D).defineComponent(PivotGizmo);

  const scene: SceneGraph = new SceneGraph();
  const nebula: NebulaRenderer = { scene } as unknown as NebulaRenderer;
  const gizmos: Gizmos = new Gizmos(
    new GizmoNodePool(nebula),
    new GizmoSettings(),
  );

  return { world, scene, gizmos, system: new PivotGizmoSystem(gizmos) };
}

function spawn(ctx: Ctx, x: number, y: number): Entity {
  const entity: Entity = ctx.world.createEntity();
  const transform: MathTransform2D = new MathTransform2D();
  transform.position.set(x, y);

  ctx.world
    .addComponent(entity, WorldTransform2D)
    .matrix.fromTransform2D(transform);

  return entity;
}

describe("PivotGizmoSystem", () => {
  it("dessine un disque rempli à la position monde de l'entité", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showPivots = true;

    spawn(ctx, 42, -17);

    ctx.system.update({ world: ctx.world, dt: 0 });

    const circle: CircleNode = ctx.scene.root.getChildren()[0] as CircleNode;
    expect(circle.transform.position.x).toBe(42);
    expect(circle.transform.position.y).toBe(-17);
    expect(circle.borderWidth).toBe(0);
    expect(circle.radius).toBe(2);
  });

  it("ne dessine rien sans composant quand showPivots est faux", () => {
    const ctx: Ctx = setup();

    spawn(ctx, 0, 0);

    ctx.system.update({ world: ctx.world, dt: 0 });

    expect(ctx.scene.root.getChildren().length).toBe(0);
  });

  it("dessine avec le composant seul quand showPivots est faux", () => {
    const ctx: Ctx = setup();

    const entity: Entity = spawn(ctx, 1, 2);
    ctx.world.addComponent(entity, PivotGizmo);

    ctx.system.update({ world: ctx.world, dt: 0 });

    expect(ctx.scene.root.getChildren().length).toBe(1);
  });

  it("laisse le composant surcharger couleur et rayon", () => {
    const ctx: Ctx = setup();

    const entity: Entity = spawn(ctx, 0, 0);
    ctx.world.addComponent(entity, PivotGizmo, new Color(1, 1, 0, 1), 9);

    ctx.system.update({ world: ctx.world, dt: 0 });

    const circle: CircleNode = ctx.scene.root.getChildren()[0] as CircleNode;
    expect(circle.radius).toBe(9);
    expect([circle.color.r, circle.color.g, circle.color.b]).toEqual([1, 1, 0]);
  });

  it("retombe sur settings.pivotRadius quand le composant laisse radius à null", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.pivotRadius = 5;

    const entity: Entity = spawn(ctx, 0, 0);
    ctx.world.addComponent(entity, PivotGizmo);

    ctx.system.update({ world: ctx.world, dt: 0 });

    const circle: CircleNode = ctx.scene.root.getChildren()[0] as CircleNode;
    expect(circle.radius).toBe(5);
  });

  it("n'est pas affecté par le borderWidth courant du service", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showPivots = true;
    ctx.gizmos.borderWidth = 4;

    spawn(ctx, 0, 0);

    ctx.system.update({ world: ctx.world, dt: 0 });

    const circle: CircleNode = ctx.scene.root.getChildren()[0] as CircleNode;
    expect(circle.borderWidth).toBe(0);
  });
});
