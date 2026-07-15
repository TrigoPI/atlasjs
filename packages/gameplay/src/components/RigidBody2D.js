import { Vec2 } from "@atlasjs/math";
export class RigidBody2D {
    mass;
    type;
    rotation;
    velocity;
    angularVelocity;
    constructor() {
        this.mass = 1;
        this.rotation = 0;
        this.velocity = new Vec2(0, 0);
        this.angularVelocity = 0;
        this.type = "dynamic";
    }
}
//# sourceMappingURL=RigidBody2D.js.map