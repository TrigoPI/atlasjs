import { PinObject, type MapObject } from "./MapObject";
import type { TiledObject, TiledPinObject } from "./tiled.types";

export abstract class MapObjectEvaluatorBase {
  abstract build(input: TiledObject): MapObject;
  abstract evaluate(input: TiledObject): boolean;
}

export class MapObjectPinEvaluator extends MapObjectEvaluatorBase {
  public build(input: TiledPinObject): MapObject {
    return new PinObject(input.name, input.x, input.y);
  }

  public evaluate(input: TiledPinObject): boolean {
    return input?.point !== undefined && input.point;
  }
}

export class MapObjectBuilder {
  private readonly builders: MapObjectEvaluatorBase[];

  public constructor(builders: MapObjectEvaluatorBase[]) {
    this.builders = [...builders];
  }

  public getObject(input: TiledObject): MapObject | undefined {
    const builder = this.builders.find((builder: MapObjectEvaluatorBase) =>
      builder.evaluate(input),
    );

    return builder ? builder.build(input) : undefined;
  }
}
