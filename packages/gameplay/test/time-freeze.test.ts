import { describe, expect, it } from "vitest";
import { TIME, TimeControl } from "@atlasjs/core";
import { Entity } from "@atlasjs/nexus";

import { TimeScale } from "../src/components";
import { TimeScaleManager, TIME_SCALE_MANAGER } from "../src/time";
import { AtlasScript } from "../src/scripting";
import { createHarness, Harness } from "./helpers/harness";

function freezeCount(manager: TimeScaleManager): number {
  return (manager as unknown as { freezes: Map<Entity, unknown> }).freezes.size;
}

describe("TimeScaleManager.freeze", () => {
  it("met l'échelle à 0 puis la restaure après la durée", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.2, [entity]);
    manager.update(0);
    expect(manager.scaleOf(entity)).toBe(0);

    manager.update(0.1);
    expect(manager.scaleOf(entity)).toBe(0);

    manager.update(0.15);
    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("un gel de 0.1s est déjà fini quand le décompte atteint exactement 0", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.1, [entity]);
    manager.update(0.1);

    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("retire le composant quand l'entité n'en portait pas avant", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.1, [entity]);
    manager.update(0.5);

    expect(harness.world.getComponent(entity, TimeScale)).toBeUndefined();
  });

  it("restaure la valeur précédente, pas 1", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, TimeScale, 0.5);

    manager.freeze(0.1, [entity]);
    manager.update(0.5);
    manager.update(0);

    expect(manager.scaleOf(entity)).toBe(0.5);
  });

  it("gèle plusieurs entités dans le même appel", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const attacker: Entity = harness.world.createEntity();
    const victim: Entity = harness.world.createEntity();

    manager.freeze(0.2, [attacker, victim]);
    manager.update(0);

    expect(manager.scaleOf(attacker)).toBe(0);
    expect(manager.scaleOf(victim)).toBe(0);
  });

  it("un second freeze prolonge sans mémoriser 0 comme valeur précédente", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, TimeScale, 0.5);

    manager.freeze(0.1, [entity]);
    manager.update(0.05);
    manager.freeze(0.3, [entity]);

    manager.update(0.2);
    expect(manager.scaleOf(entity)).toBe(0);

    manager.update(0.2);
    expect(manager.scaleOf(entity)).toBe(0.5);
  });

  it("un freeze de durée nulle ou négative ne gèle rien", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0, [entity]);
    manager.update(0);

    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("freeze(0) ne pose aucun composant TimeScale, même transitoirement", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0, [entity]);

    expect(harness.world.getComponent(entity, TimeScale)).toBeUndefined();
  });

  it("setScale et clearScale posent et retirent le composant", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.setScale(entity, 0.25);
    manager.update(0);
    expect(manager.scaleOf(entity)).toBe(0.25);

    manager.setScale(entity, 2);
    manager.update(0);
    expect(manager.scaleOf(entity)).toBe(2);

    manager.clearScale(entity);
    manager.update(0);
    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("une entité détruite pendant son gel ne fait pas lever d'exception", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.1, [entity]);
    harness.world.destroyEntity(entity);

    expect(() => manager.update(0.2)).not.toThrow();
  });

  it("freeze sur une entité déjà détruite ne fait pas lever d'exception", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    harness.world.destroyEntity(entity);

    expect(() => manager.freeze(0.1, [entity])).not.toThrow();
  });

  it("setScale sur une entité déjà détruite ne fait pas lever d'exception", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    harness.world.destroyEntity(entity);

    expect(() => manager.setScale(entity, 0.5)).not.toThrow();
  });

  it("clearScale sur une entité déjà détruite ne fait pas lever d'exception", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    harness.world.destroyEntity(entity);

    expect(() => manager.clearScale(entity)).not.toThrow();
  });

  it("purge l'entrée d'une entité détruite pendant son gel, sans fuite dans la table interne", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.1, [entity]);
    harness.world.destroyEntity(entity);
    manager.update(0.2);

    expect(freezeCount(manager)).toBe(0);
  });

  it("freeze(NaN) ne gèle rien", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(NaN, [entity]);
    manager.update(0);

    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("freeze avec une durée négative ne gèle rien", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(-0.1, [entity]);
    manager.update(0);

    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("un freeze posé sans beginFrame() intermédiaire est actif immédiatement", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.2, [entity]);

    expect(manager.scaleOf(entity)).toBe(0);
  });

  it("geler une entité qui portait déjà un TimeScale est actif sans update() préalable", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, TimeScale, 0.5);

    manager.freeze(0.2, [entity]);

    expect(manager.scaleOf(entity)).toBe(0);
  });

  it("setScale sur une entité sans TimeScale invalide une valeur déjà mémoïsée", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const memoized: Entity = harness.world.createEntity();
    const target: Entity = harness.world.createEntity();
    harness.world.addComponent(memoized, TimeScale, 0.5);

    manager.update(0);
    expect(manager.scaleOf(target)).toBe(1);

    manager.setScale(target, 0.25);

    expect(manager.scaleOf(target)).toBe(0.25);
  });

  it("un freeze invalide une valeur déjà mémoïsée dans la même frame", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, TimeScale, 0.5);

    manager.update(0);
    expect(manager.scaleOf(entity)).toBe(0.5);

    manager.freeze(0.2, [entity]);

    expect(manager.scaleOf(entity)).toBe(0);
  });

  it("clearScale invalide une valeur déjà mémoïsée dans la même frame", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    harness.world.addComponent(entity, TimeScale, 0.5);

    manager.update(0);
    expect(manager.scaleOf(entity)).toBe(0.5);

    manager.clearScale(entity);

    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("geler un parent invalide aussi l'échelle déjà mémoïsée de son enfant", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const parent: Entity = harness.world.createEntity();
    const child: Entity = harness.world.createEntity();
    harness.world.setParent(child, parent);
    harness.world.addComponent(parent, TimeScale, 0.5);

    manager.update(0);
    expect(manager.scaleOf(child)).toBe(0.5);

    manager.freeze(0.2, [parent]);

    expect(manager.scaleOf(child)).toBe(0);
    expect(manager.scaleOf(parent)).toBe(0);
  });

  it("un freeze plus court ne raccourcit pas un gel plus long en cours", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.3, [entity]);
    manager.update(0.1);
    manager.freeze(0.05, [entity]);

    manager.update(0.15);
    expect(manager.scaleOf(entity)).toBe(0);

    manager.update(0.1);
    expect(manager.scaleOf(entity)).toBe(1);
  });
});

describe("gameplay:time-scale", () => {
  it("avance le décompte une fois par frame", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.2, [entity]);

    harness.frame();
    expect(manager.scaleOf(entity)).toBe(0);

    harness.frame();
    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("une pause globale suspend aussi le décompte d'un gel", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const time: TimeControl = harness.services.get(TIME);
    const entity: Entity = harness.world.createEntity();

    manager.freeze(0.2, [entity]);
    time.scale = 0;

    harness.frame();
    harness.frame();
    harness.frame();

    expect(manager.scaleOf(entity)).toBe(0);

    time.scale = 1;
    harness.frame();
    harness.frame();

    expect(manager.scaleOf(entity)).toBe(1);
  });

  it("tourne au stage Early, avant les scripts au stage Logic", async () => {
    const harness: Harness = await createHarness();
    const manager: TimeScaleManager = harness.services.get(TIME_SCALE_MANAGER);
    const entity: Entity = harness.world.createEntity();
    const readings: number[] = [];

    class Probe extends AtlasScript {
      public onUpdate(): void {
        readings.push(manager.scaleOf(entity));
      }
    }

    harness.scripts.attach(entity, Probe);
    manager.freeze(0.05, [entity]);

    harness.frame();

    expect(readings).toEqual([1]);
  });
});
