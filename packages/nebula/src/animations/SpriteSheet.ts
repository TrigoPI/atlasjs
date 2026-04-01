import { Bound } from "@atlasjs/math";

import { Frame } from "./Frame";
import { Texture2D } from "../core";
import { FromAutoGridOptions, FromGridOptions } from "./animation-types";

export class SpriteSheet {
  private readonly texture: Texture2D;
  private readonly frames: Map<string, Frame>;

  public constructor(texture: Texture2D) {
    this.texture = texture;
    this.frames = new Map();
  }

  public has(name: string): boolean {
    return this.frames.has(name);
  }

  public define(
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): this {
    const bound: Bound = new Bound(x, y, width, height);
    const frame: Frame = new Frame(this.texture, bound);
    this.frames.set(name, frame);
    return this;
  }

  public get(name: string): Frame {
    const frame: Frame | undefined = this.frames.get(name);

    if (!frame) {
      throw new Error(`Frame '${name}' not found.`);
    }

    return frame;
  }

  public getManyInRange(prefix: string, start: number, end: number): Frame[] {
    const frames: Frame[] = [];

    for (let i = start; i <= end; i++) {
      const name: string = `${prefix}${i}`;
      if (this.has(name)) {
        frames.push(this.get(name));
      }
    }

    return frames;
  }

  public getMany(...name: string[]): Frame[] {
    return name.map((n: string) => this.get(n));
  }

  public static fromAutoGrid({
    name,
    texture,
    rows,
    columns,
  }: FromAutoGridOptions): SpriteSheet {
    const spriteSheet: SpriteSheet = new SpriteSheet(texture);
    const frameWidth: number = texture.width / columns;
    const frameHeight: number = texture.height / rows;

    let id: number = 0;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const x: number = col * frameWidth;
        const y: number = row * frameHeight;
        spriteSheet.define(`${name}_${id++}`, x, y, frameWidth, frameHeight);
      }
    }

    return spriteSheet;
  }

  public static fromGrid({
    name,
    texture,
    frameHeight,
    frameWidth,
    spacing = 0,
    margin = 0,
  }: FromGridOptions): SpriteSheet {
    const spriteSheet: SpriteSheet = new SpriteSheet(texture);
    let id: number = 0;

    for (let y = margin; y < texture.height; y += frameHeight + spacing) {
      for (let x = margin; x < texture.width; x += frameWidth + spacing) {
        spriteSheet.define(`${name}_${id++}`, x, y, frameWidth, frameHeight);
      }
    }

    return spriteSheet;
  }
}
