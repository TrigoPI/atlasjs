export class Color {
  public readonly data: Float32Array;

  constructor(r: number, g: number, b: number, a: number = 1) {
    this.data = new Float32Array(4);
    this.data[0] = r;
    this.data[1] = g;
    this.data[2] = b;
    this.data[3] = a;
  }

  public get r(): number {
    return this.data[0];
  }

  public get g(): number {
    return this.data[1];
  }

  public get b(): number {
    return this.data[2];
  }

  public get a(): number {
    return this.data[3];
  }

  public set r(value: number) {
    this.data[0] = value;
  }

  public set g(value: number) {
    this.data[1] = value;
  }

  public set b(value: number) {
    this.data[2] = value;
  }

  public set a(value: number) {
    this.data[3] = value;
  }

  public setRed(r: number): Color {
    this.data[0] = r;
    return this;
  }

  public setGreen(g: number): Color {
    this.data[1] = g;
    return this;
  }

  public setBlue(b: number): Color {
    this.data[2] = b;
    return this;
  }

  public setAlpha(a: number): Color {
    this.data[3] = a;
    return this;
  }

  public set(r: number, g: number, b: number, a: number = 1): Color {
    this.data[0] = r;
    this.data[1] = g;
    this.data[2] = b;
    this.data[3] = a;
    return this;
  }

  public clone(): Color {
    return new Color(this.r, this.g, this.b, this.a);
  }

  public static White(): Color {
    return new Color(1, 1, 1, 1);
  }

  public static Black(): Color {
    return new Color(0, 0, 0, 1);
  }

  public static Red(): Color {
    return new Color(1, 0, 0, 1);
  }

  public static Green(): Color {
    return new Color(0, 1, 0, 1);
  }

  public static Blue(): Color {
    return new Color(0, 0, 1, 1);
  }

  public static Orange(): Color {
    return new Color(1, 0.65, 0, 1);
  }
}
