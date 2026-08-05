import RAPIER from "@dimforge/rapier2d-compat";
import { Vec2 } from "@atlasjs/math";
import { CharacterController, Collider } from "@atlasjs/inertia";
import { PhysicsUnitConverter } from "./PhysicsUnitConverter";
import { RapierCollider } from "./RapierCollider";

export class RapierCharacterController implements CharacterController {
  public readonly raw: RAPIER.KinematicCharacterController;
  private readonly converter: PhysicsUnitConverter;
  private readonly scratch: Vec2;

  public constructor(
    raw: RAPIER.KinematicCharacterController,
    converter: PhysicsUnitConverter,
  ) {
    this.raw = raw;
    this.converter = converter;
    this.scratch = new Vec2();
  }

  public computeMovement(collider: Collider, desired: Vec2): Vec2 {
    if (!(collider instanceof RapierCollider)) {
      throw new Error("RapierCharacterController requires a RapierCollider.");
    }

    this.scratch.set(desired.x, desired.y);
    this.converter.vecToPhysicsInto(this.scratch);

    this.raw.computeColliderMovement(
      collider.rapierCollider,
      this.scratch,
      undefined,
      collider.rapierCollider.collisionGroups(),
    );

    const moved: RAPIER.Vector = this.raw.computedMovement();
    this.scratch.set(moved.x, moved.y);
    return this.converter.vecToWorldInto(this.scratch);
  }
}
