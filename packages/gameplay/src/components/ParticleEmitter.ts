import type {
  BlendMode,
  ParticleEmitterConfig,
  ParticleState,
  Sprite,
} from "@atlasjs/nebula";

export type ParticleEmitterCommand = "none" | "clear" | "restart";

export interface ParticleEmitterOptions {
  config?: ParticleEmitterConfig;
  frames?: ReadonlyArray<Sprite>;
  blend?: BlendMode;
  visible?: boolean;
  sortingLayer?: string;
  sortingOrder?: number;
  playOnAwake?: boolean;
}

export class ParticleEmitter {
  public config: ParticleEmitterConfig;
  public frames: ReadonlyArray<Sprite>;
  public blend: BlendMode;
  public visible: boolean;
  public sortingLayer: string;
  public sortingOrder: number;
  public state: ParticleState;
  public pendingEmit: number;
  public command: ParticleEmitterCommand;

  public constructor(options?: ParticleEmitterOptions) {
    this.config = options?.config ?? {};
    this.frames = options?.frames ?? [];
    this.blend = options?.blend ?? this.config.blend ?? "alpha";
    this.visible = options?.visible ?? true;
    this.sortingLayer = options?.sortingLayer ?? "Default";
    this.sortingOrder = options?.sortingOrder ?? 0;

    const playOnAwake: boolean = options?.playOnAwake ?? true;

    this.state = playOnAwake ? "playing" : "stopped";
    this.pendingEmit = 0;
    this.command = "none";
  }

  public play(): this {
    this.state = "playing";
    return this;
  }

  public pause(): this {
    this.state = "paused";
    return this;
  }

  public stop(): this {
    this.state = "stopped";
    return this;
  }

  public emit(count: number): this {
    if (!(count > 0) || !Number.isFinite(count)) {
      return this;
    }

    this.pendingEmit = this.pendingEmit + count;

    return this;
  }

  public clear(): this {
    this.command = "clear";

    return this;
  }

  public restart(): this {
    this.state = "playing";
    this.command = "restart";

    return this;
  }

  public setConfig(config: ParticleEmitterConfig): this {
    this.config = config;

    return this;
  }
}
