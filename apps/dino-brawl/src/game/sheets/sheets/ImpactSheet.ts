import { Vec2 } from "@atlasjs/math";
import { SpriteAnimation, SpriteSheet, type Texture2D } from "@atlasjs/nebula";

import type { ClipBuilder, SheetBuilder } from "./sheets.types";

export const ImpactSheetBuilder: SheetBuilder = (
  texture: Texture2D,
): SpriteSheet =>
  SpriteSheet.fromAutoGrid({
    texture,
    name: "impact",
    rows: 1,
    columns: 8,
    // The burst is centred on the point of contact, not standing on it.
    pivot: new Vec2(0.5, 0.5),
  });

export const ImpactClips: ClipBuilder = (
  sheet: SpriteSheet,
): Record<string, SpriteAnimation> => ({
  default: new SpriteAnimation({
    frames: sheet.getManyInRange("impact_", 0, 7),
    fps: 30,
    loop: false,
    autoPlay: true,
  }),
});
