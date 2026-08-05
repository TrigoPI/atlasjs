export class CharacterController2D {
  public offset: number;
  public slide: boolean;

  public constructor(options: { offset?: number; slide?: boolean } = {}) {
    this.offset = options.offset ?? 0.01;
    this.slide = options.slide ?? true;
  }
}
