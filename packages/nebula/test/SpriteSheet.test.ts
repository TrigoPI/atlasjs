import { describe, it, expect } from "vitest";
import { Vec2 } from "@atlasjs/math";

import { Texture2D } from "../src/core";
import { Frame, SpriteSheet } from "../src/animations";

function fakeTexture(width: number, height: number): Texture2D {
  return { __kind: "test", id: "tex", width, height, destroy: () => {} };
}

function collectFrames(sheet: SpriteSheet, name: string): Frame[] {
  const frames: Frame[] = [];

  for (let i: number = 0; sheet.has(`${name}_${i}`); i++) {
    frames.push(sheet.get(`${name}_${i}`));
  }

  return frames;
}

describe("SpriteSheet.fromGrid", () => {
  it("only defines frames fully contained in the texture (non-divisible width and height)", () => {
    const texture: Texture2D = fakeTexture(100, 70);

    const sheet: SpriteSheet = SpriteSheet.fromGrid({
      name: "grid",
      texture,
      frameWidth: 32,
      frameHeight: 32,
    });

    const frames: Frame[] = collectFrames(sheet, "grid");

    // 100 / 32 → 3 full columns (0, 32, 64); a 4th at x=96 would spill to 128.
    // 70 / 32 → 2 full rows (0, 32); a 3rd at y=64 would spill to 96.
    expect(frames.length).toBe(6);

    for (const frame of frames) {
      expect(frame.rect.x + frame.rect.width).toBeLessThanOrEqual(texture.width);
      expect(frame.rect.y + frame.rect.height).toBeLessThanOrEqual(
        texture.height,
      );
    }
  });
});

describe("SpriteSheet pivot", () => {
  it("stamps the sheet pivot onto every defined frame", () => {
    const sheet: SpriteSheet = new SpriteSheet(fakeTexture(64, 64), new Vec2(0.5, 1));
    sheet.define("a", 0, 0, 16, 16);
    expect(sheet.get("a").pivot.x).toBe(0.5);
    expect(sheet.get("a").pivot.y).toBe(1);
  });

  it("propagates the pivot through fromAutoGrid", () => {
    const sheet: SpriteSheet = SpriteSheet.fromAutoGrid({
      name: "f",
      texture: fakeTexture(64, 64),
      rows: 1,
      columns: 2,
      pivot: new Vec2(0.5, 1),
    });
    expect(sheet.get("f_0").pivot.y).toBe(1);
  });

  it("defaults a frame pivot to center when unspecified", () => {
    const sheet: SpriteSheet = new SpriteSheet(fakeTexture(64, 64));
    sheet.define("a", 0, 0, 16, 16);
    expect(sheet.get("a").pivot.x).toBe(0.5);
    expect(sheet.get("a").pivot.y).toBe(0.5);
  });
});
