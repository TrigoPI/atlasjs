import { createLogger, Logger } from "@atlasjs/utils";

import type { ResolvedTileset } from "./resolved.types";

export type TiledAssetResolver = (tileset: ResolvedTileset) => string | undefined;

const logger: Logger = createLogger("TiledAssetResolver");

function segments(path: string): string[] {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .filter((s: string) => s.length > 0 && s !== "." && s !== "..");
}

function commonTailLength(a: string[], b: string[]): number {
  let n: number = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) {
    n++;
  }
  return n;
}

export function matchAssetByTail(
  modules: Readonly<Record<string, string>>,
  image: string,
): string | undefined {
  const wanted: string[] = segments(image);
  let bestUrl: string | undefined;
  let bestScore: number = 0;
  let tie: boolean = false;

  for (const key of Object.keys(modules)) {
    const score: number = commonTailLength(segments(key), wanted);
    if (score === 0) {
      continue;
    }
    if (score > bestScore) {
      bestScore = score;
      bestUrl = modules[key];
      tie = false;
    } else if (score === bestScore) {
      tie = true;
    }
  }

  if (bestUrl === undefined) {
    return undefined;
  }
  if (tie) {
    logger.warn(`Ambiguous asset match for '${image}'; using the first best candidate.`);
  }
  return bestUrl;
}

export function createGlobTilesetResolver(): TiledAssetResolver {
  const modules: Record<string, string> = import.meta.glob(
    "../../../assets/tilesets/**/*.png",
    { eager: true, import: "default" },
  ) as Record<string, string>;

  return (tileset: ResolvedTileset): string | undefined => {
    const url: string | undefined = matchAssetByTail(modules, tileset.image);
    if (url === undefined) {
      logger.warn(`No bundled asset for tileset '${tileset.name}' (image '${tileset.image}').`);
    }
    return url;
  };
}
