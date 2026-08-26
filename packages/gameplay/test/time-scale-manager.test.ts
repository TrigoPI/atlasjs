import { describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import { TimeScale } from "../src/components";
import { TimeScaleManager, TIME_SCALE_MANAGER } from "../src/time";
import { createHarness, Harness } from "./helpers/harness";

describe("TimeScaleManager.scaleOf", () => {
  it("rend 1 pour une entité sans TimeScale nulle part", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.beginFrame();

    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("applique l'échelle portée par l'entité elle-même", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, TimeScale, 0.5);

    manager.beginFrame();

    expect(manager.scaleOf(entity)).toBe(0.5);
  });

  it("hérite l'échelle d'un ancêtre", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const root: Entity = harness.world.createEntity();
    const child: Entity = harness.world.createEntity();
    const grandChild: Entity = harness.world.createEntity();

    harness.world.setParent(child, root);
    harness.world.setParent(grandChild, child);
    harness.world.addComponent(root, TimeScale, 0);

    manager.beginFrame();

    expect(manager.scaleOf(grandChild)).toBe(0);
  });

  it("multiplie les échelles imbriquées", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const root: Entity = harness.world.createEntity();
    const child: Entity = harness.world.createEntity();

    harness.world.setParent(child, root);
    harness.world.addComponent(root, TimeScale, 0.5);
    harness.world.addComponent(child, TimeScale, 0.5);

    manager.beginFrame();

    expect(manager.scaleOf(child)).toBe(0.25);
  });

  it("laisse un sous-arbre voisin à 1", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const frozen: Entity = harness.world.createEntity();
    const other: Entity = harness.world.createEntity();

    harness.world.addComponent(frozen, TimeScale, 0);

    manager.beginFrame();

    expect(manager.scaleOf(frozen)).toBe(0);
    expect(manager.scaleOf(other)).toBe(1);
  });

  it("clampe une valeur négative à 0", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, TimeScale, -3);

    manager.beginFrame();

    expect(manager.scaleOf(entity)).toBe(0);
  });

  it("ne remonte aucun parent quand le monde ne porte aucun TimeScale", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const root: Entity = harness.world.createEntity();
    const child: Entity = harness.world.createEntity();
    harness.world.setParent(child, root);

    let parentLookups: number = 0;
    const realGetParent = harness.world.getParent.bind(harness.world);
    harness.world.getParent = (entity: Entity): Entity | undefined => {
      parentLookups += 1;
      return realGetParent(entity);
    };

    manager.beginFrame();
    manager.scaleOf(child);

    expect(parentLookups).toBe(0);
  });

  it("prend en compte un TimeScale ajouté après le beginFrame de la frame précédente", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.beginFrame();
    expect(manager.scaleOf(entity)).toBe(1);

    harness.world.addComponent(entity, TimeScale, 0);
    manager.beginFrame();

    expect(manager.scaleOf(entity)).toBe(0);
  });

  it("invalide le mémo entre deux frames quand la valeur change", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    const scale: TimeScale = harness.world.addComponent(entity, TimeScale, 0.5);

    manager.beginFrame();
    expect(manager.scaleOf(entity)).toBe(0.5);

    scale.value = 1;
    manager.beginFrame();

    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("rend 1 pour une entité détruite quand le monde porte un TimeScale", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const scaled: Entity = harness.world.createEntity();
    harness.world.addComponent(scaled, TimeScale, 0.5);
    const destroyed: Entity = harness.world.createEntity();
    harness.world.destroyEntity(destroyed);

    manager.beginFrame();

    expect(manager.scaleOf(destroyed)).toBe(1);
  });
});

describe("TimeScale", () => {
  it("vaut 1 par défaut", () => {
    expect(new TimeScale().value).toBe(1);
  });

  it("clampe une valeur négative assignée via le setter à 0", () => {
    const scale: TimeScale = new TimeScale(1);

    scale.value = -1;

    expect(scale.value).toBe(0);
  });

  it("clampe NaN à 0 dans le constructeur", () => {
    expect(new TimeScale(NaN).value).toBe(0);
  });

  it("clampe NaN à 0 via le setter", () => {
    const scale: TimeScale = new TimeScale(1);

    scale.value = NaN;

    expect(scale.value).toBe(0);
  });
});
