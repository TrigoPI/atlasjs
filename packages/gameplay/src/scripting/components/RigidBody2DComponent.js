import { RigidBody2D } from "../../components";
import { ScriptComponent } from "../core";
export class RigidBody2DComponent extends ScriptComponent {
    static engine = RigidBody2D;
    get type() {
        return this.resolve().type;
    }
    set type(value) {
        this.resolve().type = value;
    }
    get mass() {
        return this.resolve().mass;
    }
    set mass(value) {
        this.resolve().mass = value;
    }
    get velocity() {
        return this.resolve().velocity;
    }
    set velocity(value) {
        this.resolve().velocity.copyFrom(value);
    }
    get angularVelocity() {
        return this.resolve().angularVelocity;
    }
    set angularVelocity(value) {
        this.resolve().angularVelocity = value;
    }
    setVelocity(x, y) {
        this.resolve().velocity.set(x, y);
        return this;
    }
    setMass(mass) {
        this.resolve().mass = mass;
        return this;
    }
    setAngularVelocity(angularVelocity) {
        this.resolve().angularVelocity = angularVelocity;
        return this;
    }
}
//# sourceMappingURL=RigidBody2DComponent.js.map