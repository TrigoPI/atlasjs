import { DinoClips, DinoSheetBuilder } from "./sheets/DinoSheet";
import {
  RunningParticleClips,
  RunningParticleSheetBuilder,
} from "./sheets/RunningParticleSheet";
import type { SheetDescriptor } from "./sheets/sheets.types";

export const SheetList: SheetDescriptor[] = [
  {
    name: "sheet:dino",
    texture: "texture:yellow_dino",
    sheet: DinoSheetBuilder,
    clips: DinoClips,
  },
  {
    name: "sheet:evil_dino",
    texture: "texture:evil_dino",
    sheet: DinoSheetBuilder,
    clips: DinoClips,
  },
  {
    name: "sheet:running_particle",
    texture: "texture:running_particle",
    sheet: RunningParticleSheetBuilder,
    clips: RunningParticleClips,
  },
];
