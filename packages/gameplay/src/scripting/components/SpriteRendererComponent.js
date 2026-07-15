import { SpriteRender } from "../../components";
import { ScriptComponent } from "../core";
export class SpriteRendererComponent extends ScriptComponent {
    static engine = SpriteRender;
    get texture() {
        return this.resolve().texture;
    }
    isVisible() {
        return this.resolve().visible;
    }
}
//# sourceMappingURL=SpriteRendererComponent.js.map