export type TiledLayer = TiledGroupLayer | TiledTileLayer;

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
