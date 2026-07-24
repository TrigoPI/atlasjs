export class TileLayer {
  public readonly name: string;
  public readonly data: number[];

  public constructor(name: string, data: number[]) {
    this.name = name;
    this.data = data;
  }
}
