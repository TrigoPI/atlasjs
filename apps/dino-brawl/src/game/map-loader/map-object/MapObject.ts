import type { MapObjectType } from "./map-object.types";

export class MapObject {
  public readonly type: MapObjectType;
  public readonly name: string;

  public constructor(type: MapObjectType, name: string) {
    this.type = type;
    this.name = name;
  }
}

export class PinObject extends MapObject {
  public readonly x: number;
  public readonly y: number;

  public constructor(name: string, x: number, y: number) {
    super("pin", name);
    this.x = x;
    this.y = y;
  }
}
