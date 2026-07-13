import { ServiceRegistry, ServiceToken } from "@atlasjs/core";
import { NexusWorld } from "../world";

export const NEXUS: ServiceToken<NexusWorld> =
  ServiceRegistry.createToken("NEXUS");
