import { NexusSystemContext } from "./nexus-types";

export interface NexusSystem {
  update(context: NexusSystemContext): void;
}
