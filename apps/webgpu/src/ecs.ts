import { NexusWorld, type Query } from "@atlasjs/nexus";

type Position = { x: number; y: number };
type Velocity = { x: number; y: number };

const nexus: NexusWorld = new NexusWorld();

const PositionComponent = nexus.defineComponent<Position>("position");
const VelocityComponent = nexus.defineComponent<Velocity>("velocity");

const a = nexus.createEntity();
const b = nexus.createEntity();
const c = nexus.createEntity();
const d = nexus.createEntity();
const e = nexus.createEntity();

nexus.addComponent(a, PositionComponent, { x: 0, y: 0 });
nexus.addComponent(a, VelocityComponent, { x: 1, y: 1 });

nexus.addComponent(b, PositionComponent, { x: 1, y: 1 });
nexus.addComponent(b, VelocityComponent, { x: 2, y: 2 });

nexus.addComponent(c, PositionComponent, { x: 2, y: 2 });
nexus.addComponent(c, VelocityComponent, { x: 3, y: 3 });

nexus.addComponent(d, PositionComponent, { x: 3, y: 3 });
nexus.addComponent(d, VelocityComponent, { x: 4, y: 4 });

nexus.addComponent(e, PositionComponent, { x: 4, y: 4 });
nexus.addComponent(e, VelocityComponent, { x: 5, y: 5 });

const query: Query = nexus.query(PositionComponent, VelocityComponent);

for (const entity of query.entities()) {
  const position: Position = nexus.requireComponent(entity, PositionComponent);
  const velocity: Velocity = nexus.requireComponent(entity, VelocityComponent);

  console.log(
    `Entity ${entity}: Position(${position.x}, ${position.y}), Velocity(${velocity.x}, ${velocity.y})`,
  );
}
