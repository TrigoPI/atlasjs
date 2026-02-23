import { EventBus } from "@atlasjs/core";
import { RendererEvents } from "../public/events";

export interface RendererLike {
  events: EventBus<RendererEvents>;
}
