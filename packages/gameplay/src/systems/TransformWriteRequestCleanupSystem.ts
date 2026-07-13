import { NexusSystem, NexusSystemContext } from "@atlasjs/nexus";
import { TransformWriteRequest } from "../components";

export class TransformWriteRequestCleanupSystem implements NexusSystem {
  public update({ world }: NexusSystemContext): void {
    // Deferred removal: mutating the component being iterated directly would
    // trip the query's structural-change guard. Applied at the lane flush.
    world.query(TransformWriteRequest).each((entity) => {
      world.commands.remove(entity, TransformWriteRequest);
    });
  }
}
