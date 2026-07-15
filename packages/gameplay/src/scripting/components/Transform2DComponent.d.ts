import { Vec2 } from "@atlasjs/math";
import { Transform2D } from "../../components";
import { ScriptComponent } from "../core";
export declare class Transform2DComponent extends ScriptComponent<Transform2D> {
    static readonly engine: typeof Transform2D;
    get position(): Vec2;
    set position(value: Vec2);
    get rotation(): number;
    set rotation(value: number);
    get scale(): Vec2;
    set scale(value: Vec2);
    setPosition(x: number, y: number): this;
    setRotation(rotation: number): this;
    setScale(x: number, y: number): this;
    translate(dx: number, dy: number): this;
    rotate(angle: number): this;
    private controllingBody;
}
//# sourceMappingURL=Transform2DComponent.d.ts.map