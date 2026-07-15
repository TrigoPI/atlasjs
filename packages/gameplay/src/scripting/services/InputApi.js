import { INPUT } from "@atlasjs/input";
import { ScriptService } from "../core";
export class InputApi extends ScriptService {
    static token = INPUT;
    isDown(key) {
        return this.provided.isDown(key);
    }
    isPressed(key) {
        return this.provided.isPressed(key);
    }
    isReleased(key) {
        return this.provided.isReleased(key);
    }
    get mousePosition() {
        return this.provided.pointer.position;
    }
    get mouseDelta() {
        return this.provided.pointer.delta;
    }
    get scrollDelta() {
        return this.provided.pointer.wheelDelta;
    }
}
//# sourceMappingURL=InputApi.js.map