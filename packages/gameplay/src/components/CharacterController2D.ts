export class CharacterController2D {
  public readonly offset: number;
  public readonly slide: boolean;

  public constructor(options: { offset?: number; slide?: boolean } = {}) {
    this.offset = options.offset ?? 0.01;
    this.slide = options.slide ?? true;
  }
}
