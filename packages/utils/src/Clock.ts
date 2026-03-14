export class Clock {
  private start: number;

  public constructor() {
    this.start = Date.now();
  }

  public getTimeSecond(): number {
    return (Date.now() - this.start) / 1000;
  }

  public getTimeMili(): number {
    return Date.now() - this.start;
  }

  public resetSecond(): number {
    const end: number = this.getTimeSecond();
    this.start = Date.now();
    return end;
  }

  public resetMili(): number {
    const end: number = this.getTimeMili();
    this.start = Date.now();
    return end;
  }
}
