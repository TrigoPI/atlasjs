import { NexusSystem, NexusSystemContext, Query } from "@atlasjs/nexus";
import { TransformWriteRequest } from "../components";

export class TransformWriteRequestCleanupSystem implements NexusSystem {
  public update({ world }: NexusSystemContext): void {
    const query: Query = world.query(TransformWriteRequest);

    for (const entity of query.entities()) {
      world.removeComponent(entity, TransformWriteRequest);
    }
  }
}
