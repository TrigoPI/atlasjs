import { EventBus, ServiceRegistry } from "../engine";
import { EngineEvents } from "../engine/types";

export interface SceneContext {
  services: ServiceRegistry;
  events: EventBus<EngineEvents>;
}
