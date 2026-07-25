import type { MapObject } from "./MapObject";
import type { TiledLayer, TiledMap } from "./tiled.type";
import { MapObjectBuilder, MapObjectPinEvaluator } from "./MapObjectBuilder";

export class MapObjectManager {
  private readonly mapObjects: Record<string, MapObject>;
  private readonly objectBuilder: MapObjectBuilder;

  public constructor(map: TiledMap) {
    this.objectBuilder = new MapObjectBuilder([new MapObjectPinEvaluator()]);
    this.mapObjects = this.getObjects(map, map.layers, {});
  }

  public getObject<T extends MapObject>(name: string): T | undefined {
    return this.mapObjects[name] as T | undefined;
  }

  public getObjects(
    map: TiledMap,
    layers: TiledLayer[],
    input: Record<string, MapObject>,
  ): Record<string, MapObject> {
    const result: Record<string, MapObject> = input;

    for (const layer of layers) {
      if (layer.type === "group") {
        this.getObjects(map, layer.layers, input);
      }

      if (layer.type === "objectgroup") {
        for (const obj of layer.objects) {
          if (obj.name.length === 0) {
            continue;
          }

          const mapObjects: MapObject | undefined =
            this.objectBuilder.getObject(obj);

          if (mapObjects) {
            result[obj.name] = mapObjects;
          }
        }
      }
    }

    return result;
  }
}
