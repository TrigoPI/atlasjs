import { PhysicsBodyRef, RigidBody2D, Transform2D } from "../components";
export class PhysicsPullSystem {
    // prettier-ignore
    update({ world }) {
        world.query(RigidBody2D, Transform2D, PhysicsBodyRef).each((_, rigidBody, transform, ref) => {
            const body = ref.body;
            transform.position.copyFrom(body.getTranslation());
            transform.rotation = body.getRotation();
            rigidBody.velocity.copyFrom(body.getLinearVelocity());
            rigidBody.angularVelocity = body.getAngularVelocity();
        });
    }
}
//# sourceMappingURL=PhysicsPullSystem.js.map