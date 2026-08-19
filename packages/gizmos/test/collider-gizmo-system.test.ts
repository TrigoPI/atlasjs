import { afterEach, describe, expect, it, vi } from "vitest";
import { Logger } from "@atlasjs/utils";
import { Transform2D as MathTransform2D, Vec2 } from "@atlasjs/math";
import { Color, SceneGraph } from "@atlasjs/nebula";
import type {
  CircleNode,
  NebulaRenderer,
  Node,
  RectNode,
} from "@atlasjs/nebula";
import { NexusWorld } from "@atlasjs/nexus";
import type { Entity } from "@atlasjs/nexus";
import type { Collider, ColliderShapeDesc } from "@atlasjs/inertia";
import {
  Collider2D,
  PhysicsColliderRef,
  WorldTransform2D,
} from "@atlasjs/gameplay";

import { GizmoNodePool } from "../src/GizmoNodePool";
import { GizmoSettings } from "../src/GizmoSettings";
import { Gizmos } from "../src/Gizmos";
import { ColliderGizmo } from "../src/components/ColliderGizmo";
import { ColliderGizmoSystem } from "../src/systems/ColliderGizmoSystem";

interface Ctx {
  world: NexusWorld;
  scene: SceneGraph;
  gizmos: Gizmos;
  system: ColliderGizmoSystem;
}

function setup(): Ctx {
  const world: NexusWorld = new NexusWorld();
  world
    .defineComponent(WorldTransform2D)
    .defineComponent(Collider2D)
    .defineComponent(PhysicsColliderRef)
    .defineComponent(ColliderGizmo);

  const scene: SceneGraph = new SceneGraph();
  const nebula: NebulaRenderer = { scene } as unknown as NebulaRenderer;
  const gizmos: Gizmos = new Gizmos(
    new GizmoNodePool(nebula),
    new GizmoSettings(),
  );

  return { world, scene, gizmos, system: new ColliderGizmoSystem(gizmos) };
}

function fakeCollider(x: number, y: number, rotation: number = 0): Collider {
  return {
    getTranslation: (): Vec2 => new Vec2(x, y),
    getRotation: (): number => rotation,
  } as unknown as Collider;
}

/** Entité avec un WorldTransform2D à `scale`, un Collider2D et son ref physique. */
function spawn(
  ctx: Ctx,
  shape: ColliderShapeDesc,
  colliderWorld: { x: number; y: number; rotation?: number },
  scale: number = 1,
): Entity {
  const entity: Entity = ctx.world.createEntity();

  const transform: MathTransform2D = new MathTransform2D();
  transform.scale.set(scale, scale);
  ctx.world
    .addComponent(entity, WorldTransform2D)
    .matrix.fromTransform2D(transform);

  ctx.world.addComponent(entity, Collider2D, shape);
  ctx.world.addComponent(
    entity,
    PhysicsColliderRef,
    fakeCollider(colliderWorld.x, colliderWorld.y, colliderWorld.rotation ?? 0),
  );

  return entity;
}

function visible(scene: SceneGraph): ReadonlyArray<Node> {
  return scene.root.getChildren().filter((node: Node) => node.visible);
}

describe("ColliderGizmoSystem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dessine la vérité physique, pas l'intention : extents non scalés à la position rapier", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showColliders = true;

    spawn(ctx, { type: "box", width: 40, height: 40 }, { x: 300, y: 120 }, 2);

    ctx.system.update({ world: ctx.world, dt: 0 });

    const rect: RectNode = ctx.scene.root.getChildren()[0] as RectNode;
    expect(rect.width).toBe(40);
    expect(rect.height).toBe(40);
    expect(rect.transform.position.x).toBe(300);
    expect(rect.transform.position.y).toBe(120);
  });

  it("reporte la rotation du collider rapier", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showColliders = true;

    spawn(
      ctx,
      { type: "box", width: 10, height: 10 },
      { x: 0, y: 0, rotation: 0.75 },
    );

    ctx.system.update({ world: ctx.world, dt: 0 });

    const rect: RectNode = ctx.scene.root.getChildren()[0] as RectNode;
    expect(rect.transform.rotation).toBe(0.75);
  });

  it("ne dessine rien pour un Collider2D sans PhysicsColliderRef", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showColliders = true;

    const entity: Entity = ctx.world.createEntity();
    const transform: MathTransform2D = new MathTransform2D();
    ctx.world
      .addComponent(entity, WorldTransform2D)
      .matrix.fromTransform2D(transform);
    ctx.world.addComponent(entity, Collider2D, {
      type: "box",
      width: 40,
      height: 40,
    });

    ctx.system.update({ world: ctx.world, dt: 0 });

    expect(ctx.scene.root.getChildren().length).toBe(0);
  });

  it("ne dessine rien même avec le composant si PhysicsColliderRef est absent", () => {
    const ctx: Ctx = setup();

    const entity: Entity = ctx.world.createEntity();
    const transform: MathTransform2D = new MathTransform2D();
    ctx.world
      .addComponent(entity, WorldTransform2D)
      .matrix.fromTransform2D(transform);
    ctx.world.addComponent(entity, Collider2D, {
      type: "box",
      width: 40,
      height: 40,
    });
    ctx.world.addComponent(entity, ColliderGizmo);

    ctx.system.update({ world: ctx.world, dt: 0 });

    expect(ctx.scene.root.getChildren().length).toBe(0);
  });

  it("dessine un cercle pour un collider circle", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showColliders = true;

    spawn(ctx, { type: "circle", radius: 12 }, { x: 5, y: 6 });

    ctx.system.update({ world: ctx.world, dt: 0 });

    const circle: CircleNode = ctx.scene.root.getChildren()[0] as CircleNode;
    expect(circle.radius).toBe(12);
    expect(circle.borderWidth).toBe(1);
  });

  it("utilise sensorColor pour un sensor", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showColliders = true;

    const entity: Entity = spawn(
      ctx,
      { type: "box", width: 10, height: 10 },
      { x: 0, y: 0 },
    );
    ctx.world.requireComponent(entity, Collider2D).isSensor = true;

    ctx.system.update({ world: ctx.world, dt: 0 });

    const rect: RectNode = ctx.scene.root.getChildren()[0] as RectNode;
    expect([rect.color.r, rect.color.g, rect.color.b]).toEqual([0, 1, 1]);
  });

  it("dessine sans composant quand showColliders est vrai", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showColliders = true;

    spawn(ctx, { type: "box", width: 10, height: 10 }, { x: 0, y: 0 });

    ctx.system.update({ world: ctx.world, dt: 0 });

    expect(visible(ctx.scene).length).toBe(1);
  });

  it("ne dessine rien sans composant quand showColliders est faux", () => {
    const ctx: Ctx = setup();

    spawn(ctx, { type: "box", width: 10, height: 10 }, { x: 0, y: 0 });

    ctx.system.update({ world: ctx.world, dt: 0 });

    expect(ctx.scene.root.getChildren().length).toBe(0);
  });

  it("dessine avec le composant seul quand showColliders est faux", () => {
    const ctx: Ctx = setup();

    const entity: Entity = spawn(
      ctx,
      { type: "box", width: 10, height: 10 },
      { x: 0, y: 0 },
    );
    ctx.world.addComponent(entity, ColliderGizmo);

    ctx.system.update({ world: ctx.world, dt: 0 });

    expect(visible(ctx.scene).length).toBe(1);
  });

  it("ne dessine qu'une fois quand le composant et le switch global sont actifs", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showColliders = true;

    const entity: Entity = spawn(
      ctx,
      { type: "box", width: 10, height: 10 },
      { x: 0, y: 0 },
    );
    ctx.world.addComponent(entity, ColliderGizmo);

    ctx.system.update({ world: ctx.world, dt: 0 });

    expect(visible(ctx.scene).length).toBe(1);
  });

  it("laisse le composant surcharger la couleur", () => {
    const ctx: Ctx = setup();

    const entity: Entity = spawn(
      ctx,
      { type: "box", width: 10, height: 10 },
      { x: 0, y: 0 },
    );
    ctx.world.addComponent(entity, ColliderGizmo, new Color(1, 0, 0, 1));

    ctx.system.update({ world: ctx.world, dt: 0 });

    const rect: RectNode = ctx.scene.root.getChildren()[0] as RectNode;
    expect([rect.color.r, rect.color.g, rect.color.b]).toEqual([1, 0, 0]);
  });

  it("ne réutilise pas la couleur du sensor pour le collider solide suivant", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showColliders = true;

    const sensor: Entity = spawn(
      ctx,
      { type: "box", width: 10, height: 10 },
      { x: 0, y: 0 },
    );
    ctx.world.requireComponent(sensor, Collider2D).isSensor = true;

    spawn(ctx, { type: "box", width: 10, height: 10 }, { x: 50, y: 0 });

    ctx.system.update({ world: ctx.world, dt: 0 });

    const rects: ReadonlyArray<RectNode> =
      ctx.scene.root.getChildren() as ReadonlyArray<RectNode>;

    expect(rects.length).toBe(2);

    const colors: number[][] = rects.map((r: RectNode) => [
      r.color.r,
      r.color.g,
      r.color.b,
    ]);

    expect(colors).toContainEqual([0, 1, 1]);
    expect(colors).toContainEqual([0, 1, 0]);
  });

  it("ne dessine rien pour une capsule et ne warn qu'une fois sur 3 frames", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showColliders = true;
    const warn = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => {});

    spawn(ctx, { type: "capsule", radius: 5, halfHeight: 10 }, { x: 0, y: 0 });

    ctx.system.update({ world: ctx.world, dt: 0 });
    ctx.system.update({ world: ctx.world, dt: 0 });
    ctx.system.update({ world: ctx.world, dt: 0 });

    expect(ctx.scene.root.getChildren().length).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
