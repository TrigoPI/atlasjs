import RAPIER from "@dimforge/rapier2d-compat";
import { Vec2 } from "@atlasjs/math";
import { CharacterController, Collider } from "@atlasjs/inertia";
import { PhysicsUnitConverter } from "./PhysicsUnitConverter";
import { RapierCollider } from "./RapierCollider";

export class RapierCharacterController implements CharacterController {
  public readonly raw: RAPIER.KinematicCharacterController;
  private readonly converter: PhysicsUnitConverter;

  public constructor(raw: RAPIER.KinematicCharacterController, converter: PhysicsUnitConverter) {
    this.raw = raw;
    this.converter = converter;
  }

  public computeMovement(collider: Collider, desired: Vec2): Vec2 {
    if (!(collider instanceof RapierCollider)) {
      throw new Error("RapierCharacterController requires a RapierCollider.");
    }

    const desiredPhysics: Vec2 = this.converter.vecToPhysics(desired);

    this.raw.computeColliderMovement(
      collider.rapierCollider,
      { x: desiredPhysics.x, y: desiredPhysics.y },
      undefined,
      collider.rapierCollider.collisionGroups(),
    );

    const moved: RAPIER.Vector = this.raw.computedMovement();
    return this.converter.vecToWorld(new Vec2(moved.x, moved.y));
  }
}
