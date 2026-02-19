import { EventBus } from "@atlasjs/core";
import { RendererEvents } from "../../events";

export interface RendererLike {
  events: EventBus<RendererEvents>;
}
