import { ServiceRegistry, ServiceToken } from "@atlasjs/core";
import { PhysicsWorld } from "./PhysicsWorld";

export const INERTIAL_ENGINE: ServiceToken<PhysicsWorld> =
  ServiceRegistry.createToken<PhysicsWorld>("INERTIAL_ENGINE");
