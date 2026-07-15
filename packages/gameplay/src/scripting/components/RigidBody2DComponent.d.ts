import { Vec2 } from "@atlasjs/math";
import { RigidBodyType } from "@atlasjs/inertia";
import { RigidBody2D } from "../../components";
import { ScriptComponent } from "../core";
export declare class RigidBody2DComponent extends ScriptComponent<RigidBody2D> {
    static readonly engine: typeof RigidBody2D;
    get type(): RigidBodyType;
    set type(value: RigidBodyType);
    get mass(): number;
    set mass(value: number);
    get velocity(): Vec2;
    set velocity(value: Vec2);
    get angularVelocity(): number;
    set angularVelocity(value: number);
    setVelocity(x: number, y: number): this;
    setMass(mass: number): this;
    setAngularVelocity(angularVelocity: number): this;
}
//# sourceMappingURL=RigidBody2DComponent.d.ts.map