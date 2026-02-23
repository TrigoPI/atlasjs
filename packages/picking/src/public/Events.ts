import type { Vec2Like } from "@atlasjs/math";

export type PickingEventPayload = {
  nodeId: string;
  world: Vec2Like;
};

export type PickingEvents = {
  "pick:hoverEnter": PickingEventPayload;
  "pick:hoverLeave": PickingEventPayload;
  "pick:down": PickingEventPayload;
  "pick:up": PickingEventPayload;
  "pick:move": PickingEventPayload;
};
