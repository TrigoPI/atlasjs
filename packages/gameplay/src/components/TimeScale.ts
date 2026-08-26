export class TimeScale {
  private stored: number;

  public constructor(value: number = 1) {
    this.stored = value > 0 ? value : 0;
  }

  public get value(): number {
    return this.stored;
  }

  public set value(next: number) {
    this.stored = next > 0 ? next : 0;
  }
}
