import RAPIER from "@dimforge/rapier2d-compat";
import { RigidBodyType } from "@atlasjs/inertia";

export function mapRigidBodyType(
  type: RigidBodyType = "dynamic",
): RAPIER.RigidBodyType {
  switch (type) {
    case "static":
      return RAPIER.RigidBodyType.Fixed;
    case "kinematic":
      return RAPIER.RigidBodyType.KinematicPositionBased;
    case "dynamic":
    default:
      return RAPIER.RigidBodyType.Dynamic;
  }
}
