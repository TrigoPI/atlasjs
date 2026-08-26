import type { Entity } from "@atlasjs/nexus";

export function stubEntity(id: number): Entity {
  return id as Entity;
}
