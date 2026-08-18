import { describe, expect, it } from "vitest";
import { SceneGraph } from "@atlasjs/nebula";
import type {
  CircleNode,
  NebulaRenderer,
  Node,
  RectNode,
} from "@atlasjs/nebula";
import { GIZMO_SORTING_LAYER } from "../src/NodeRing";
import { GizmoNodePool } from "../src/GizmoNodePool";
import { GizmoSettings } from "../src/GizmoSettings";
import { Gizmos } from "../src/Gizmos";

function setup(): { scene: SceneGraph; pool: GizmoNodePool; gizmos: Gizmos } {
  const scene: SceneGraph = new SceneGraph();
  const nebula: NebulaRenderer = { scene } as unknown as NebulaRenderer;
  const pool: GizmoNodePool = new GizmoNodePool(nebula);
  const gizmos: Gizmos = new Gizmos(pool, new GizmoSettings());

  return { scene, pool, gizmos };
}

describe("GizmoNodePool", () => {
  it("crée un nœud par forme et l'ajoute à la scène", () => {
    const { scene, gizmos } = setup();

    gizmos.drawRect(10, 20, 40, 60, 0);
    gizmos.drawCircle(5, 5, 8);

    expect(scene.root.getChildren().length).toBe(2);
  });

  it("pose GIZMO_SORTING_LAYER sur les nœuds acquis", () => {
    const { scene, gizmos } = setup();

    gizmos.drawRect(0, 0, 10, 10, 0);

    expect(scene.root.getChildren()[0].sortingLayer).toBe(GIZMO_SORTING_LAYER);
    expect(GIZMO_SORTING_LAYER).toBe(1_000_000);
  });

  it("réutilise les mêmes instances à la frame suivante", () => {
    const { scene, pool, gizmos } = setup();

    gizmos.drawRect(0, 0, 10, 10, 0);
    gizmos.drawRect(0, 0, 10, 10, 0);
    const first: RectNode = scene.root.getChildren()[0] as RectNode;
    const second: RectNode = scene.root.getChildren()[1] as RectNode;

    pool.hideUnused();
    pool.reset();

    gizmos.drawRect(1, 1, 20, 20, 0);
    gizmos.drawRect(1, 1, 20, 20, 0);

    expect(scene.root.getChildren().length).toBe(2);
    expect(scene.root.getChildren()[0]).toBe(first);
    expect(scene.root.getChildren()[1]).toBe(second);
  });

  it("masque les nœuds non réutilisés et remontre ceux qui le sont", () => {
    const { scene, pool, gizmos } = setup();

    gizmos.drawRect(0, 0, 10, 10, 0);
    gizmos.drawRect(0, 0, 10, 10, 0);
    gizmos.drawRect(0, 0, 10, 10, 0);
    pool.hideUnused();
    pool.reset();

    gizmos.drawRect(0, 0, 10, 10, 0);
    pool.hideUnused();

    const children: ReadonlyArray<Node> = scene.root.getChildren();
    expect(children[0].visible).toBe(true);
    expect(children[1].visible).toBe(false);
    expect(children[2].visible).toBe(false);

    pool.reset();
    gizmos.drawRect(0, 0, 10, 10, 0);
    gizmos.drawRect(0, 0, 10, 10, 0);
    expect(children[1].visible).toBe(true);
  });

  it("applique la couleur courante, la géométrie et le borderWidth", () => {
    const { scene, gizmos } = setup();

    gizmos.color.set(0, 1, 0, 1);
    gizmos.borderWidth = 3;
    gizmos.drawRect(10, 20, 40, 60, 0.5);

    const rect: RectNode = scene.root.getChildren()[0] as RectNode;
    expect(rect.color.g).toBe(1);
    expect(rect.color.r).toBe(0);
    expect(rect.borderWidth).toBe(3);
    expect(rect.width).toBe(40);
    expect(rect.height).toBe(60);
    expect(rect.transform.position.x).toBe(10);
    expect(rect.transform.position.y).toBe(20);
    expect(rect.transform.rotation).toBe(0.5);
  });

  it("dessine un disque quand borderWidth vaut 0", () => {
    const { scene, gizmos } = setup();

    gizmos.borderWidth = 0;
    gizmos.drawCircle(0, 0, 7);

    const circle: CircleNode = scene.root.getChildren()[0] as CircleNode;
    expect(circle.borderWidth).toBe(0);
    expect(circle.radius).toBe(7);
  });

  it("dispose retire les nœuds de la scène", () => {
    const { scene, pool, gizmos } = setup();

    gizmos.drawRect(0, 0, 10, 10, 0);
    gizmos.drawCircle(0, 0, 5);
    pool.dispose();

    expect(scene.root.getChildren().length).toBe(0);
  });
});
