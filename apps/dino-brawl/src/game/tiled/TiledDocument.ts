import { createLogger, Logger } from "@atlasjs/utils";

import { resolveGid } from "./gid";
import type {
  ResolvedCell,
  ResolvedObject,
  ResolvedTileLayer,
  ResolvedTileset,
} from "./resolved.types";
import type {
  TiledLayer,
  TiledMap,
  TiledObject,
  TiledProperty,
  TiledTileSet,
} from "./tiled.raw.types";

export class TiledDocument {
  public readonly width: number;
  public readonly height: number;
  public readonly tileWidth: number;
  public readonly tileHeight: number;

  private readonly logger: Logger;
  private readonly resolvedTilesets: ResolvedTileset[];
  private readonly resolvedLayers: ResolvedTileLayer[];
  private readonly resolvedObjects: ResolvedObject[];

  public constructor(json: unknown) {
    const map: TiledMap = json as TiledMap;
    this.logger = createLogger(TiledDocument.name);
    this.width = map.width;
    this.height = map.height;
    this.tileWidth = map.tilewidth;
    this.tileHeight = map.tileheight;

    this.resolvedTilesets = this.resolveTilesets(map.tilesets);
    this.resolvedLayers = [];
    this.resolvedObjects = [];
    this.walk(map.layers, []);
  }

  public get tilesets(): readonly ResolvedTileset[] {
    return this.resolvedTilesets;
  }

  public get tileLayers(): readonly ResolvedTileLayer[] {
    return this.resolvedLayers;
  }

  public get objects(): readonly ResolvedObject[] {
    return this.resolvedObjects;
  }

  private resolveTilesets(tilesets: TiledTileSet[]): ResolvedTileset[] {
    const result: ResolvedTileset[] = [];

    for (const ts of tilesets) {
      if (!ts.image) {
        this.logger.warn(`Tileset '${ts.name}' has no image; skipped.`);
        continue;
      }

      result.push({
        name: ts.name,
        image: ts.image,
        firstGid: ts.firstgid,
        columns: ts.columns,
        rows: Math.floor(ts.tilecount / ts.columns),
        tileCount: ts.tilecount,
        tileWidth: ts.tilewidth,
        tileHeight: ts.tileheight,
        spacing: ts.spacing ?? 0,
        margin: ts.margin ?? 0,
      });
    }

    return result;
  }

  private tilesetForGid(gid: number): ResolvedTileset | undefined {
    return this.resolvedTilesets.find(
      (ts: ResolvedTileset) => gid >= ts.firstGid && gid < ts.firstGid + ts.tileCount,
    );
  }

  private atlasLocalIndex(gid: number, tileset: ResolvedTileset): number {
    const local: number = gid - tileset.firstGid;
    const col: number = local % tileset.columns;
    const tiledRow: number = Math.floor(local / tileset.columns);
    const atlasRow: number = tileset.rows - 1 - tiledRow;
    return atlasRow * tileset.columns + col;
  }

  private walk(layers: TiledLayer[], groupPath: string[]): void {
    for (const layer of layers) {
      if (layer.type === "group") {
        this.walk(layer.layers, [...groupPath, layer.name]);
      } else if (layer.type === "tilelayer") {
        this.resolvedLayers.push(this.resolveTileLayer(layer.name, layer.data, groupPath));
      } else if (layer.type === "objectgroup") {
        for (const obj of layer.objects) {
          const resolved: ResolvedObject | undefined = this.resolveObject(obj, groupPath);
          if (resolved) {
            this.resolvedObjects.push(resolved);
          }
        }
      }
    }
  }

  private resolveTileLayer(
    name: string,
    data: number[],
    groupPath: string[],
  ): ResolvedTileLayer {
    const cells: ResolvedCell[] = [];

    for (let i: number = 0; i < data.length; i++) {
      const raw: number = data[i];
      if (raw === 0) {
        continue;
      }

      const { gid, flipX, flipY } = resolveGid(raw);
      const tileset: ResolvedTileset | undefined = this.tilesetForGid(gid);

      if (!tileset) {
        this.logger.warn(`No tileset for gid ${gid} in layer '${name}'; cell skipped.`);
        continue;
      }

      cells.push({
        cx: i % this.width,
        cy: Math.floor(i / this.width),
        tileset,
        localIndex: this.atlasLocalIndex(gid, tileset),
        flipX,
        flipY,
      });
    }

    return { name, groupPath: [...groupPath], order: this.resolvedLayers.length, cells };
  }

  private resolveObject(obj: TiledObject, groupPath: string[]): ResolvedObject | undefined {
    if (obj.name.length === 0) {
      return undefined;
    }

    const base = {
      name: obj.name,
      x: obj.x,
      y: obj.y,
      groupPath: [...groupPath],
      properties: this.readProperties(obj.properties),
    };

    if (obj.point) {
      return { ...base, kind: "point" };
    }

    if (obj.gid !== undefined) {
      const { gid, flipX, flipY } = resolveGid(obj.gid);
      const tileset: ResolvedTileset | undefined = this.tilesetForGid(gid);

      if (!tileset) {
        this.logger.warn(`No tileset for object gid ${gid} ('${obj.name}'); skipped.`);
        return undefined;
      }

      return {
        ...base,
        kind: "tile",
        tileset,
        localIndex: this.atlasLocalIndex(gid, tileset),
        flipX,
        flipY,
        width: obj.width,
        height: obj.height,
      };
    }

    return { ...base, kind: "rect", width: obj.width, height: obj.height };
  }

  private readProperties(props?: TiledProperty[]): Readonly<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    if (props) {
      for (const p of props) {
        result[p.name] = p.value;
      }
    }
    return result;
  }
}
