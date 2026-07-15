import { Texture2D } from "@atlasjs/nebula";
import { SpriteRender } from "../../components";
import { ScriptComponent } from "../core";
export declare class SpriteRendererComponent extends ScriptComponent<SpriteRender> {
    static readonly engine: typeof SpriteRender;
    get texture(): Texture2D;
    isVisible(): boolean;
}
//# sourceMappingURL=SpriteRendererComponent.d.ts.map