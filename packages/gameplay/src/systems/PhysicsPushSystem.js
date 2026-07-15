import { PhysicsBodyRef, RigidBody2D, Transform2D } from "../components";
export class PhysicsPushSystem {
    inertia;
    pending;
    constructor(inertia) {
        this.inertia = inertia;
        this.pending = [];
    }
    // prettier-ignore
    update({ world }) {
        world.query(RigidBody2D, Transform2D).without(PhysicsBodyRef).each((entity) => {
            this.pending.push(entity);
        });
        for (const entity of this.pending) {
            const rigidBody = world.requireComponent(entity, RigidBody2D);
            const transform = world.requireComponent(entity, Transform2D);
            const body = this.inertia.createRigidBody({
                type: rigidBody.type,
                translation: transform.position,
                rotation: transform.rotation,
                linearVelocity: rigidBody.velocity,
                angularVelocity: rigidBody.angularVelocity,
            });
            world.addComponent(entity, PhysicsBodyRef, body);
        }
        this.pending.length = 0;
        world.query(RigidBody2D, Transform2D, PhysicsBodyRef).each((_, rigidBody, transform, ref) => {
            const body = ref.body;
            body.setMass(rigidBody.mass);
            body.setLinearVelocity(rigidBody.velocity.x, rigidBody.velocity.y);
            body.setAngularVelocity(rigidBody.angularVelocity);
            if (rigidBody.type === "kinematic" || rigidBody.type === "static") {
                body.setTranslation(transform.position.x, transform.position.y);
                body.setRotation(transform.rotation);
            }
        });
    }
}
//# sourceMappingURL=PhysicsPushSystem.js.map