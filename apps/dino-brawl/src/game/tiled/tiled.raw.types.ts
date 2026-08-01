export type TiledLayer = TiledGroupLayer | TiledTileLayer | TiledObjectGroup;

export interface TiledTileLayer {
  type: "tilelayer";
  name: string;
  data: number[];
}

export interface TiledGroupLayer {
  type: "group";
  name: string;
  layers: TiledLayer[];
}

export interface TiledObjectGroup {
  type: "objectgroup";
  name: string;
  objects: TiledObject[];
}

export interface TiledObject {
  id: number;
  name: string;
  type?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  point?: boolean;
  gid?: number;
  properties?: TiledProperty[];
}

export interface TiledProperty {
  name: string;
  type: string;
  value: unknown;
}

export interface TiledTileSet {
  name: string;
  columns: number;
  imagewidth?: number;
  imageheight?: number;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  firstgid: number;
  spacing?: number;
  margin?: number;
  image?: string | null;
}

export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTileSet[];
}
