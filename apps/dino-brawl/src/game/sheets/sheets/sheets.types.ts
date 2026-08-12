import type { SpriteAnimation, SpriteSheet, Texture2D } from "@atlasjs/nebula";

export type SheetBuilder = (texture: Texture2D) => SpriteSheet;

export type ClipBuilder = (
  sheet: SpriteSheet,
) => Record<string, SpriteAnimation>;

export type SheetDescriptor = {
  name: string;
  texture: string;
  sheet: SheetBuilder;
  clips: ClipBuilder;
};
