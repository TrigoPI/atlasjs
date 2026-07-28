import { Layer } from "./Layer";
import type { TiledLayer, TiledMap } from "./tiled.type";

export class LayerManager {
  private readonly layers: Record<string, Layer>;

  public constructor(map: TiledMap) {
    this.layers = this.getLayers(map, map.layers);
  }

  public addLayer(layer: Layer): void {
    this.layers[layer.name] = layer;
  }

  public getLayer(name: string): Layer | undefined {
    return this.layers[name];
  }

  private getLayers(
    map: TiledMap,
    layers: TiledLayer[],
    input: Record<string, Layer> = {},
  ): Record<string, Layer> {
    const result: Record<string, Layer> = input;

    for (const layer of layers) {
      if (layer.type === "group") {
        this.getLayers(map, layer.layers, input);
      }

      if (layer.type === "tilelayer") {
        result[layer.name] = new Layer(layer.name, layer.data, map.width);
      }
    }

    return result;
  }
}
