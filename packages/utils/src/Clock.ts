export class Clock {
  private start: number;
  private paused: boolean;
  private pauseTime: number;

  public constructor() {
    this.start = Date.now();
    this.paused = false;
    this.pauseTime = 0;
  }

  public pause(): void {
    this.paused = true;
    this.pauseTime = Date.now();
  }

  public resume(): void {
    if (!this.paused) return;
    this.start += Date.now() - this.pauseTime;
    this.paused = false;
  }

  public getTimeSecond(): number {
    return (Date.now() - this.start) / 1000;
  }

  public getTimeMilliseconds(): number {
    return Date.now() - this.start;
  }

  public resetSecond(): number {
    const end: number = this.getTimeSecond();
    this.start = Date.now();
    return end;
  }

  public resetMilliseconds(): number {
    const end: number = this.getTimeMilliseconds();
    this.start = Date.now();
    return end;
  }

  public reset(): void {
    this.start = Date.now();
  }
}
