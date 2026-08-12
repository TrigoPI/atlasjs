import { Vec2 } from "@atlasjs/math";
import { SpriteAnimation, SpriteSheet, type Texture2D } from "@atlasjs/nebula";

import type { ClipBuilder, SheetBuilder } from "./sheets.types";

export const RunningParticleSheetBuilder: SheetBuilder = (
  texture: Texture2D,
): SpriteSheet =>
  SpriteSheet.fromAutoGrid({
    texture,
    name: "running_particle",
    rows: 1,
    columns: 8,
    pivot: new Vec2(0.5, 1),
  });

export const RunningParticleClips: ClipBuilder = (
  sheet: SpriteSheet,
): Record<string, SpriteAnimation> => ({
  default: new SpriteAnimation({
    frames: sheet.getManyInRange("running_particle_", 0, 7),
    fps: 15,
    loop: false,
    autoPlay: true,
  }),
});
