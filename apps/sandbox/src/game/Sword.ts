import type { Input } from "@atlasjs/input";
import {
  type Sampler,
  type Texture2D,
  NebulaRenderer,
  Sprite,
} from "@atlasjs/nebula";

export class Sword {
  private readonly sword: Sprite;
  private readonly input: Input;
  private readonly renderer: NebulaRenderer;

  public constructor(
    texture: Texture2D,
    sampler: Sampler,
    input: Input,
    renderer: NebulaRenderer,
  ) {
    this.sword = new Sprite(texture, sampler);
    this.input = input;
    this.renderer = renderer;

    this.sword.setScale(0.5, 0.5).setPosition(0, 5).setAnchor(0, 1);
    this.input = input;
  }

  public attachTo(node: Sprite): void {
    node.addChild(this.sword);
  }

  public update(dt: number): void {}
}
