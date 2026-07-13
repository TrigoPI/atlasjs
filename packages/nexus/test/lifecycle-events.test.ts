import { describe, expect, it } from "vitest";

import { NexusWorld } from "../src/NexusWorld";
import { ComponentRegistry } from "../src/ComponentRegistry";
import { Entity, Unsubscribe } from "../src/nexus-types";

class Position {
  public x: number;
  public constructor(x: number = 0) {
    this.x = x;
  }
}

function world(): NexusWorld {
  return new NexusWorld(new ComponentRegistry());
}

describe("lifecycle events", () => {
  it("fires onAdd with the entity and the new instance", () => {
    const w: NexusWorld = world();
    const events: Array<[Entity, number]> = [];
    w.onAdd(Position, (entity, position) => events.push([entity, position.x]));

    const entity: Entity = w.createEntity();
    const added: Position = w.addComponent(entity, Position, 42);

    expect(events).toEqual([[entity, 42]]);
    expect(added.x).toBe(42);
  });

  it("fires onAdd when attaching an existing instance", () => {
    const w: NexusWorld = world();
    const seen: Position[] = [];
    w.onAdd(Position, (_entity, position) => seen.push(position));

    const entity: Entity = w.createEntity();
    const instance: Position = new Position(7);
    w.addComponent(entity, instance);

    expect(seen).toEqual([instance]);
  });

  it("fires onRemove on removeComponent with the outgoing instance", () => {
    const w: NexusWorld = world();
    const events: Array<[Entity, number]> = [];
    w.onRemove(Position, (entity, position) =>
      events.push([entity, position.x]),
    );

    const entity: Entity = w.createEntity();
    w.addComponent(entity, Position, 3);
    w.removeComponent(entity, Position);

    expect(events).toEqual([[entity, 3]]);
  });

  it("fires onRemove for every component when an entity is destroyed", () => {
    const w: NexusWorld = world();
    const removed: Entity[] = [];
    w.onRemove(Position, (entity) => removed.push(entity));

    const entity: Entity = w.createEntity();
    w.addComponent(entity, Position, 1);
    w.destroyEntity(entity);

    expect(removed).toEqual([entity]);
  });

  it("does not fire onAdd when setComponent overwrites an existing value", () => {
    const w: NexusWorld = world();
    let adds: number = 0;
    w.onAdd(Position, () => adds++);

    const entity: Entity = w.createEntity();
    w.setComponent(entity, Position, 1); // insert -> fires
    w.setComponent(entity, Position, 2); // overwrite -> no add

    expect(adds).toBe(1);
    expect(w.getComponent(entity, Position)?.x).toBe(2);
  });

  it("fires events when deferred commands are flushed", () => {
    const w: NexusWorld = world();
    const adds: Entity[] = [];
    const removes: Entity[] = [];
    w.onAdd(Position, (entity) => adds.push(entity));
    w.onRemove(Position, (entity) => removes.push(entity));

    const entity: Entity = w.createEntity();
    w.commands.add(entity, Position, 1);
    expect(adds).toEqual([]); // deferred

    w.flush();
    expect(adds).toEqual([entity]);

    w.commands.remove(entity, Position);
    w.flush();
    expect(removes).toEqual([entity]);
  });

  it("stops delivering after unsubscribe", () => {
    const w: NexusWorld = world();
    let count: number = 0;
    const off: Unsubscribe = w.onAdd(Position, () => count++);

    w.addComponent(w.createEntity(), Position, 1);
    off();
    w.addComponent(w.createEntity(), Position, 2);

    expect(count).toBe(1);
  });
});
