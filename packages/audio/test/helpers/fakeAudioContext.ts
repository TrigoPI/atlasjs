export class FakeGainNode {
  public gain: { value: number } = { value: 1 };
  public connections: unknown[] = [];
  public disconnected: boolean = false;
  public connect(node: unknown): void {
    this.connections.push(node);
  }
  public disconnect(): void {
    this.disconnected = true;
  }
}

export class FakeBufferSourceNode {
  public buffer: unknown = null;
  public loop: boolean = false;
  public playbackRate: { value: number } = { value: 1 };
  public started: boolean = false;
  public stopped: boolean = false;
  public disconnected: boolean = false;
  public onended: (() => void) | null = null;
  public connect(_node: unknown): void {}
  public disconnect(): void {
    this.disconnected = true;
  }
  public start(): void {
    this.started = true;
  }
  public stop(): void {
    this.stopped = true;
  }
}

export class FakeAudioContext {
  public state: string = "suspended";
  public resumeCalls: number = 0;
  public suspendCalls: number = 0;
  public closed: boolean = false;
  public readonly destination: object = {};
  public readonly gains: FakeGainNode[] = [];
  public readonly sources: FakeBufferSourceNode[] = [];

  public createGain(): FakeGainNode {
    const gain: FakeGainNode = new FakeGainNode();
    this.gains.push(gain);
    return gain;
  }
  public createBufferSource(): FakeBufferSourceNode {
    const source: FakeBufferSourceNode = new FakeBufferSourceNode();
    this.sources.push(source);
    return source;
  }
  public async decodeAudioData(_data: ArrayBuffer): Promise<AudioBuffer> {
    return { duration: 1 } as AudioBuffer;
  }
  public async resume(): Promise<void> {
    this.resumeCalls++;
    this.state = "running";
  }
  public async suspend(): Promise<void> {
    this.suspendCalls++;
    this.state = "suspended";
  }
  public async close(): Promise<void> {
    this.closed = true;
    this.state = "closed";
  }
}
