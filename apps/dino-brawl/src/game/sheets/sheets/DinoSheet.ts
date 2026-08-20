import { Vec2 } from "@atlasjs/math";
import { SpriteAnimation, SpriteSheet, type Texture2D } from "@atlasjs/nebula";

import type { ClipBuilder, SheetBuilder } from "./sheets.types";

export const DinoSheetBuilder: SheetBuilder = (
  texture: Texture2D,
): SpriteSheet =>
  SpriteSheet.fromAutoGrid({
    texture,
    name: "dino",
    rows: 1,
    columns: 24,
    pivot: new Vec2(0.5, 1),
  });

export const DinoClips: ClipBuilder = (
  sheet: SpriteSheet,
): Record<string, SpriteAnimation> => ({
  idle: new SpriteAnimation({
    frames: sheet.getManyInRange("dino_", 0, 3),
    fps: 5,
    loop: true,
    autoPlay: true,
  }),
  run: new SpriteAnimation({
    frames: sheet.getManyInRange("dino_", 4, 9),
    fps: 12,
    loop: true,
    autoPlay: true,
  }),
  hurt: new SpriteAnimation({
    frames: sheet.getManyInRange("dino_", 14, 16),
    fps: 24,
    loop: false,
    autoPlay: true,
  }),
  pre_sprint: new SpriteAnimation({
    frames: sheet.getManyInRange("dino_", 17, 17),
    fps: 1,
    loop: false,
    autoPlay: true,
  }),
  sprint: new SpriteAnimation({
    frames: sheet.getManyInRange("dino_", 18, 23),
    fps: 12,
    loop: true,
    autoPlay: true,
  }),
});
