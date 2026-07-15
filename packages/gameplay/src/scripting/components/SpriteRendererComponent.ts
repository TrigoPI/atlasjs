import { Texture2D } from "@atlasjs/nebula";
import { SpriteRender } from "../../components";
import { ScriptComponent } from "../core";

export class SpriteRendererComponent extends ScriptComponent<SpriteRender> {
  public static readonly engine = SpriteRender;

  public get texture(): Texture2D {
    return this.resolve().texture;
  }

  public isVisible(): boolean {
    return this.resolve().visible;
  }
}
