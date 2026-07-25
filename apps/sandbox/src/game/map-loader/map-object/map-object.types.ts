export type MapObjectType = "pin" | "rect";

export type TileSetConstructorData = {
  name: string;
  columns: number;
  imageHeight: number;
  imageWidth: number;
  tileWidth: number;
  tileHeight: number;
  tileCount: number;
  firstGid: number;
};

export type TileIndex = {
  x: number;
  y: number;
};

export type TileData = {
  position: TilePosition;
  id: number;
};

export type TilePosition = {
  cx: number;
  cy: number;
};

export type SerializedTile = {
  position: TilePosition;
  tileIndex: number;
  tilesetId: string;
};
