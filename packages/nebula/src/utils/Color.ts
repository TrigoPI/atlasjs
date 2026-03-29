export class Color {
  public readonly data: Float32Array;

  constructor(r: number, g: number, b: number, a: number) {
    this.data = new Float32Array(4);
    this.data[0] = r;
    this.data[1] = g;
    this.data[2] = b;
    this.data[3] = a;
  }

  set(r: number, g: number, b: number, a: number): void {
    this.data[0] = r;
    this.data[1] = g;
    this.data[2] = b;
    this.data[3] = a;
  }
}
