export interface ResolvedTileset {
  readonly name: string;
  readonly image: string;
  readonly firstGid: number;
  readonly columns: number;
  readonly tileCount: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly spacing: number;
  readonly margin: number;
}

export interface ResolvedCell {
  readonly cx: number;
  readonly cy: number;
  readonly tileset: ResolvedTileset;
  readonly localIndex: number;
  readonly flipX: boolean;
  readonly flipY: boolean;
}

export interface ResolvedTileLayer {
  readonly name: string;
  readonly groupPath: readonly string[];
  readonly order: number;
  readonly cells: readonly ResolvedCell[];
}

export interface ObjectBase {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly groupPath: readonly string[];
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface PointObject extends ObjectBase {
  readonly kind: "point";
}

export interface TileObject extends ObjectBase {
  readonly kind: "tile";
  readonly tileset: ResolvedTileset;
  readonly localIndex: number;
  readonly flipX: boolean;
  readonly flipY: boolean;
  readonly width: number;
  readonly height: number;
}

export interface RectObject extends ObjectBase {
  readonly kind: "rect";
  readonly width: number;
  readonly height: number;
}

export type ResolvedObject = PointObject | TileObject | RectObject;
