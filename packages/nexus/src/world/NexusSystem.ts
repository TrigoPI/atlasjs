import { NexusSystemContext } from "../types";

export interface NexusSystem {
  update(context: NexusSystemContext): void;
}
