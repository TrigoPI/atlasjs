import { ServiceRegistry, ServiceToken } from "@atlasjs/core";
import { NexusWorld } from "./NexusWorld";

export const NEXUS: ServiceToken<NexusWorld> =
  ServiceRegistry.createToken("NEXUS");
