import { Node } from "@atlasjs/render";
import type { Vec2Like } from "@atlasjs/math";

export type PickingEventPayload = {
  node: Node | null;
  world: Vec2Like;
};

export type PickingEvents = {
  "pick:hoverEnter": PickingEventPayload;
  "pick:hoverLeave": PickingEventPayload;
  "pick:down": PickingEventPayload;
  "pick:up": PickingEventPayload;
  "pick:move": PickingEventPayload;
};

export type DragEvents = {
  "drag:start": PickingEventPayload;
  "drag:move": PickingEventPayload;
  "drag:end": PickingEventPayload;
};
