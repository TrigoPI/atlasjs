export type TiledLayer = TiledGroupLayer | TiledTileLayer | TiledObjectGroup;

export type TiledTileLayer = {
  type: "tilelayer";
  id: number;
  name: string;
  data: number[];
};

export type TiledGroupLayer = {
  type: "group";
  id: number;
  name: string;
  layers: TiledLayer[];
};

export type TiledObjectGroup = {
  type: "objectgroup";
  objects: TiledObject[];
};

export type TiledPinObject = {
  name: string;
  point: boolean;
  x: number;
  y: number;
};

export type TiledRectPointObject = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TiledObject = TiledPinObject | TiledRectPointObject;

export type TiledTileSet = {
  name: string;
  columns: number;
  imageheight: number;
  imagewidth: number;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  firstgid: number;
};

export type TiledMap = {
  width: number;
  height: number;
  tileidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTileSet[];
};
