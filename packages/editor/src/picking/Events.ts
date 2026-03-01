import { Node } from "@atlasjs/nebula";
import type { Vec2 } from "@atlasjs/math";

export type PickingEventPayload = {
  node: Node | null;
  world: Vec2;
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
