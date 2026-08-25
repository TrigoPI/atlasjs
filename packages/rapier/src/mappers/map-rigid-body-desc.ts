import RAPIER from "@dimforge/rapier2d-compat";
import { RigidBodyDesc, RigidBodyType } from "@atlasjs/inertia";
import { PhysicsUnitConverter } from "../PhysicsUnitConverter";
import { mapRigidBodyType } from "./map-rigid-body-type";

function createRapierRigidBodyDesc(
  type: RigidBodyType = "dynamic",
): RAPIER.RigidBodyDesc {
  return new RAPIER.RigidBodyDesc(mapRigidBodyType(type));
}

function scaleDesc(
  desc: RigidBodyDesc,
  converter: PhysicsUnitConverter,
): RigidBodyDesc {
  const cpy: RigidBodyDesc = { ...desc };

  if (cpy.translation) {
    cpy.translation = converter.vecToPhysics(cpy.translation);
  }

  if (cpy.linearVelocity) {
    cpy.linearVelocity = converter.vecToPhysics(cpy.linearVelocity);
  }

  return cpy;
}

export function mapRigidBodyDesc(
  desc: RigidBodyDesc,
  converter: PhysicsUnitConverter,
): RAPIER.RigidBodyDesc {
  const descScale: RigidBodyDesc = scaleDesc(desc, converter);
  const rb: RAPIER.RigidBodyDesc = createRapierRigidBodyDesc(desc.type);

  if (descScale.translation) {
    rb.setTranslation(descScale.translation.x, descScale.translation.y);
  }

  if (descScale.rotation !== undefined) {
    rb.setRotation(descScale.rotation);
  }

  if (descScale.linearVelocity) {
    rb.setLinvel(descScale.linearVelocity.x, descScale.linearVelocity.y);
  }

  if (descScale.angularVelocity !== undefined) {
    rb.setAngvel(descScale.angularVelocity);
  }

  if (descScale.linearDamping !== undefined) {
    rb.setLinearDamping(descScale.linearDamping);
  }

  if (descScale.angularDamping !== undefined) {
    rb.setAngularDamping(descScale.angularDamping);
  }

  if (descScale.gravityScale !== undefined) {
    rb.setGravityScale(descScale.gravityScale);
  }

  if (descScale.canSleep !== undefined) {
    rb.setCanSleep(descScale.canSleep);
  }

  if (descScale.enabled !== undefined) {
    rb.setEnabled(descScale.enabled);
  }

  if (descScale.userData !== undefined) {
    rb.userData = descScale.userData;
  }

  return rb;
}
