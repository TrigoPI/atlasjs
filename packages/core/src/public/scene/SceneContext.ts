import { EventBus, ServiceRegistry } from "../engine";
import { EngineEvents, StepSet } from "../engine/types";

export interface SceneContext {
  services: ServiceRegistry;
  events: EventBus<EngineEvents>;
  scheduler: StepSet;
}
