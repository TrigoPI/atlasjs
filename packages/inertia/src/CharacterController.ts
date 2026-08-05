import { Vec2 } from "@atlasjs/math";
import { Collider } from "./Collider";

export interface CharacterController {
  computeMovement(collider: Collider, desired: Vec2): Vec2;
}
