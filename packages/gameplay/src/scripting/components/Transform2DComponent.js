import { PhysicsBodyRef, RigidBody2D, Transform2D } from "../../components";
import { ScriptComponent } from "../core";
export class Transform2DComponent extends ScriptComponent {
    static engine = Transform2D;
    get position() {
        return this.resolve().position;
    }
    set position(value) {
        this.setPosition(value.x, value.y);
    }
    get rotation() {
        return this.resolve().rotation;
    }
    set rotation(value) {
        this.setRotation(value);
    }
    get scale() {
        return this.resolve().scale;
    }
    set scale(value) {
        this.setScale(value.x, value.y);
    }
    setPosition(x, y) {
        this.resolve().position.set(x, y);
        const body = this.controllingBody();
        if (body !== undefined) {
            body.body.setTranslation(x, y);
        }
        return this;
    }
    setRotation(rotation) {
        this.resolve().rotation = rotation;
        const body = this.controllingBody();
        if (body !== undefined) {
            body.body.setRotation(rotation);
        }
        return this;
    }
    setScale(x, y) {
        this.resolve().scale.set(x, y);
        return this;
    }
    translate(dx, dy) {
        const position = this.resolve().position;
        return this.setPosition(position.x + dx, position.y + dy);
    }
    rotate(angle) {
        return this.setRotation(this.resolve().rotation + angle);
    }
    controllingBody() {
        const rigidBody = this.world.getComponent(this.entity, RigidBody2D);
        if (rigidBody === undefined || rigidBody.type !== "dynamic") {
            return undefined;
        }
        return this.world.getComponent(this.entity, PhysicsBodyRef);
    }
}
//# sourceMappingURL=Transform2DComponent.js.map