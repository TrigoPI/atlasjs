import { Vec2 } from "@atlasjs/math";
import { Input as InputService, Key } from "@atlasjs/input";
import { ScriptService } from "../core";
export declare class InputApi extends ScriptService<InputService> {
    static readonly token: import("@atlasjs/core").ServiceToken<InputService>;
    isDown(key: Key): boolean;
    isPressed(key: Key): boolean;
    isReleased(key: Key): boolean;
    get mousePosition(): Vec2;
    get mouseDelta(): Vec2;
    get scrollDelta(): number;
}
//# sourceMappingURL=InputApi.d.ts.map