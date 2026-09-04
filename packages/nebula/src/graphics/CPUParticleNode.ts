import { Easing, MathUtils, PI_2, Vec2, Vec4 } from "@atlasjs/math";
import { randomRange } from "@atlasjs/utils";
import type { Sampler, Texture2D } from "../core";
import { BlendMode } from "../core";
import { Color } from "../utils";
import { Node } from "./Node";
import {
  ColorRange,
  EasingName,
  ParticleAlignment,
  ParticleBurst,
  ParticleEmitterConfig,
  ParticleShape,
  ParticleSimulationSpace,
  ParticleState,
  ParticleTextureSheet,
  ParticleVector2,
  Ramp,
  ScalarRange,
} from "./particle-types";

const DEFAULT_CAPACITY: number = 256;
const MIN_CAPACITY: number = 1;
const MIN_LIFETIME: number = 1 / 10000;
const PREWARM_STEP: number = 1 / 60;
const MAX_PREWARM_STEPS: number = 600;
const MAX_LOOP_STEPS: number = 64;
const DEFAULT_SHAPE: ParticleShape = { kind: "point" };

function mulberry32(seed: number): () => number {
  let state: number = seed >>> 0;

  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t: number = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function easingValue(name: EasingName | undefined, t: number): number {
  switch (name) {
    case "inOutQuad":
      return Easing.inOutQuad(t);
    case "outCubic":
      return Easing.outCubic(t);
    case "outQuint":
      return Easing.outQuint(t);
    case "spring":
      return Easing.spring(t);
    case "outBack":
      return Easing.outBack(t);
    default:
      return t;
  }
}

function positiveOrZero(value: number): number {
  return value > 0 ? value : 0;
}

function clampCapacity(value: number): number {
  if (!(value > MIN_CAPACITY)) {
    return MIN_CAPACITY;
  }

  return Number.isFinite(value) ? Math.floor(value) : MIN_CAPACITY;
}

function resolveScalar(range: ScalarRange, rng: () => number): number {
  if (typeof range === "number") {
    return range;
  }

  return randomRange(range.min, range.max, rng);
}

function resolveCycles(cycles: number | undefined): number {
  if (cycles === undefined) {
    return 1;
  }

  if (!(cycles > 1)) {
    return 1;
  }

  return Number.isFinite(cycles) ? Math.floor(cycles) : 1;
}

export class CPUParticleNode extends Node {
  public duration: number;
  public looping: boolean;
  public prewarm: boolean;
  public rate: number;
  public shape: ParticleShape;
  public startLifetime: ScalarRange;
  public startSpeed: ScalarRange;
  public startSize: ScalarRange;
  public startRotation: ScalarRange;
  public startColor: ColorRange;
  public angularVelocity: ScalarRange;
  public readonly gravity: Vec2;
  public drag: number;
  public sizeOverLifetime: Ramp<number> | null;
  public colorOverLifetime: Ramp<Color> | null;
  public velocityOverLifetime: Ramp<ParticleVector2> | null;
  public simulationSpace: ParticleSimulationSpace;
  public alignment: ParticleAlignment;
  public blend: BlendMode;
  public textureSheet: ParticleTextureSheet | null;
  public texture: Texture2D | null;
  public sampler?: Sampler;

  private readonly rects: Vec4[];
  private readonly fullRect: Vec4;

  private xs: Float32Array;
  private ys: Float32Array;
  private vxs: Float32Array;
  private vys: Float32Array;
  private ages: Float32Array;
  private lifetimes: Float32Array;
  private size0s: Float32Array;
  private rotations: Float32Array;
  private angularVelocities: Float32Array;
  private r0s: Float32Array;
  private g0s: Float32Array;
  private b0s: Float32Array;
  private a0s: Float32Array;
  private frames: Float32Array;

  private living: number;
  private currentState: ParticleState;
  private emitterTime: number;
  private requestedMax: number;
  private rateAccumulator: number;
  private burstList: readonly ParticleBurst[];
  private burstCyclesDone: Int32Array;
  private burstNextTime: Float32Array;
  private rng: () => number;

  private offsetX: number;
  private offsetY: number;
  private directionX: number;
  private directionY: number;

  public constructor(config: ParticleEmitterConfig = {}) {
    super();

    const requested: number =
      config.maxParticles !== undefined
        ? config.maxParticles
        : DEFAULT_CAPACITY;
    const size: number = clampCapacity(requested);

    this.duration = config.duration !== undefined ? config.duration : 1;
    this.looping = config.looping !== undefined ? config.looping : true;
    this.prewarm = config.prewarm !== undefined ? config.prewarm : false;
    this.requestedMax = requested;
    this.rate = config.rate !== undefined ? config.rate : 10;
    this.shape = config.shape !== undefined ? config.shape : DEFAULT_SHAPE;
    this.startLifetime =
      config.startLifetime !== undefined ? config.startLifetime : 1;
    this.startSpeed = config.startSpeed !== undefined ? config.startSpeed : 100;
    this.startSize = config.startSize !== undefined ? config.startSize : 8;
    this.startRotation =
      config.startRotation !== undefined ? config.startRotation : 0;
    this.startColor =
      config.startColor !== undefined
        ? config.startColor
        : new Color(1, 1, 1, 1);
    this.angularVelocity =
      config.angularVelocity !== undefined ? config.angularVelocity : 0;
    this.gravity = new Vec2(
      config.gravity !== undefined ? config.gravity.x : 0,
      config.gravity !== undefined ? config.gravity.y : 0,
    );
    this.drag = config.drag !== undefined ? config.drag : 0;
    this.sizeOverLifetime =
      config.sizeOverLifetime !== undefined ? config.sizeOverLifetime : null;
    this.colorOverLifetime =
      config.colorOverLifetime !== undefined ? config.colorOverLifetime : null;
    this.velocityOverLifetime =
      config.velocityOverLifetime !== undefined
        ? config.velocityOverLifetime
        : null;
    this.simulationSpace =
      config.simulationSpace !== undefined ? config.simulationSpace : "local";
    this.alignment =
      config.alignment !== undefined ? config.alignment : "fixed";
    this.blend = config.blend !== undefined ? config.blend : "alpha";
    this.textureSheet =
      config.textureSheet !== undefined ? config.textureSheet : null;
    this.texture = null;

    this.rects = [];
    this.fullRect = new Vec4(0, 0, 1, 1);

    this.xs = new Float32Array(size);
    this.ys = new Float32Array(size);
    this.vxs = new Float32Array(size);
    this.vys = new Float32Array(size);
    this.ages = new Float32Array(size);
    this.lifetimes = new Float32Array(size);
    this.size0s = new Float32Array(size);
    this.rotations = new Float32Array(size);
    this.angularVelocities = new Float32Array(size);
    this.r0s = new Float32Array(size);
    this.g0s = new Float32Array(size);
    this.b0s = new Float32Array(size);
    this.a0s = new Float32Array(size);
    this.frames = new Float32Array(size);

    this.living = 0;
    this.currentState = "stopped";
    this.emitterTime = 0;
    this.rateAccumulator = 0;
    this.burstList = config.bursts !== undefined ? config.bursts : [];
    this.burstCyclesDone = new Int32Array(this.burstList.length);
    this.burstNextTime = new Float32Array(this.burstList.length);
    this.rng =
      config.seed !== undefined && Number.isFinite(config.seed)
        ? mulberry32(config.seed)
        : Math.random;

    this.offsetX = 0;
    this.offsetY = 0;
    this.directionX = 0;
    this.directionY = 0;

    this.armBursts();
  }

  public get aliveCount(): number {
    return this.living;
  }

  public get maxParticles(): number {
    return this.requestedMax;
  }

  public set maxParticles(value: number) {
    this.requestedMax = value;
    this.setCapacity(value);
  }

  public get capacity(): number {
    return this.xs.length;
  }

  public get state(): ParticleState {
    return this.currentState;
  }

  public get isEmitting(): boolean {
    if (this.currentState !== "playing") {
      return false;
    }

    return this.looping || this.emitterTime < positiveOrZero(this.duration);
  }

  public get isAlive(): boolean {
    return this.living > 0 || this.currentState === "playing";
  }

  public get bursts(): readonly ParticleBurst[] {
    return this.burstList;
  }

  public set bursts(value: readonly ParticleBurst[]) {
    if (value === this.burstList) {
      return;
    }

    this.burstList = value;

    if (this.burstCyclesDone.length !== value.length) {
      this.burstCyclesDone = new Int32Array(value.length);
      this.burstNextTime = new Float32Array(value.length);
    }

    this.armBursts();
  }

  public play(): this {
    if (this.currentState === "paused") {
      this.currentState = "playing";
      return this;
    }

    this.currentState = "playing";
    this.emitterTime = 0;
    this.rateAccumulator = 0;
    this.armBursts();

    if (this.prewarm && this.looping) {
      const steps: number = Math.min(
        Math.floor(positiveOrZero(this.duration) / PREWARM_STEP),
        MAX_PREWARM_STEPS,
      );

      for (let i: number = 0; i < steps; i++) {
        this.advance(PREWARM_STEP);
      }
    }

    return this;
  }

  public stop(): this {
    this.currentState = "stopped";
    return this;
  }

  public pause(): this {
    this.currentState = "paused";
    return this;
  }

  public emit(count: number): this {
    if (!(count > 0)) {
      return this;
    }

    const requested: number = Number.isFinite(count) ? Math.floor(count) : 0;

    for (let i: number = 0; i < requested; i++) {
      if (!this.spawnOne()) {
        break;
      }
    }

    return this;
  }

  public clear(): this {
    this.living = 0;
    return this;
  }

  public advance(dt: number): void {
    if (!(dt > 0)) {
      return;
    }

    if (this.currentState === "paused") {
      return;
    }

    if (this.currentState === "playing") {
      this.runEmitter(dt);
    }

    this.integrate(dt);
  }

  public setCapacity(capacity: number): this {
    const size: number = clampCapacity(capacity);

    if (size === this.xs.length) {
      return this;
    }

    const kept: number = Math.min(this.living, size);

    this.xs = CPUParticleNode.resize(this.xs, size, kept);
    this.ys = CPUParticleNode.resize(this.ys, size, kept);
    this.vxs = CPUParticleNode.resize(this.vxs, size, kept);
    this.vys = CPUParticleNode.resize(this.vys, size, kept);
    this.ages = CPUParticleNode.resize(this.ages, size, kept);
    this.lifetimes = CPUParticleNode.resize(this.lifetimes, size, kept);
    this.size0s = CPUParticleNode.resize(this.size0s, size, kept);
    this.rotations = CPUParticleNode.resize(this.rotations, size, kept);
    this.angularVelocities = CPUParticleNode.resize(
      this.angularVelocities,
      size,
      kept,
    );
    this.r0s = CPUParticleNode.resize(this.r0s, size, kept);
    this.g0s = CPUParticleNode.resize(this.g0s, size, kept);
    this.b0s = CPUParticleNode.resize(this.b0s, size, kept);
    this.a0s = CPUParticleNode.resize(this.a0s, size, kept);
    this.frames = CPUParticleNode.resize(this.frames, size, kept);

    this.living = kept;

    return this;
  }

  public setFrameRects(rects: ReadonlyArray<Vec4>): this {
    this.rects.length = 0;

    for (let i: number = 0; i < rects.length; i++) {
      this.rects.push(rects[i]);
    }

    return this;
  }

  public get frameCount(): number {
    return this.rects.length;
  }

  public getX(index: number): number {
    return this.xs[index];
  }

  public getY(index: number): number {
    return this.ys[index];
  }

  public getVelocityX(index: number): number {
    return this.vxs[index];
  }

  public getVelocityY(index: number): number {
    return this.vys[index];
  }

  public getRotation(index: number): number {
    return this.rotations[index];
  }

  public getLifeT(index: number): number {
    const lifetime: number = this.lifetimes[index];

    if (!(lifetime > 0)) {
      return 1;
    }

    return MathUtils.clamp(this.ages[index] / lifetime, 0, 1);
  }

  public getSize(index: number): number {
    const ramp: Ramp<number> | null = this.sizeOverLifetime;

    if (ramp === null) {
      return this.size0s[index];
    }

    const eased: number = easingValue(ramp.easing, this.getLifeT(index));

    return this.size0s[index] * MathUtils.lerp(ramp.from, ramp.to, eased);
  }

  public getColor(index: number, out: Vec4): Vec4 {
    const ramp: Ramp<Color> | null = this.colorOverLifetime;

    if (ramp === null) {
      return out.set(
        this.r0s[index],
        this.g0s[index],
        this.b0s[index],
        this.a0s[index],
      );
    }

    const eased: number = easingValue(ramp.easing, this.getLifeT(index));

    return out.set(
      this.r0s[index] * MathUtils.lerp(ramp.from.r, ramp.to.r, eased),
      this.g0s[index] * MathUtils.lerp(ramp.from.g, ramp.to.g, eased),
      this.b0s[index] * MathUtils.lerp(ramp.from.b, ramp.to.b, eased),
      this.a0s[index] * MathUtils.lerp(ramp.from.a, ramp.to.a, eased),
    );
  }

  public getFrameRect(index: number): Vec4 {
    const sheet: ParticleTextureSheet | null = this.textureSheet;

    if (sheet === null) {
      return this.fullRect;
    }

    const count: number = this.rects.length;

    if (!(count > 0)) {
      return this.fullRect;
    }

    if (!Number.isInteger(index) || index < 0 || index >= this.frames.length) {
      return this.fullRect;
    }

    if (sheet.mode === "randomFrame") {
      const stored: number = this.frames[index];

      if (!(stored >= 0) || stored >= count) {
        return this.fullRect;
      }

      return this.rects[stored];
    }

    const total: number = count * resolveCycles(sheet.cycles);
    const last: number = total - 1;
    const raw: number = Math.floor(this.getLifeT(index) * total);
    const step: number = raw < last ? raw : last;

    return this.rects[step % count];
  }

  private sampleFrame(rng: () => number): number {
    const sheet: ParticleTextureSheet | null = this.textureSheet;

    if (sheet === null || sheet.mode !== "randomFrame") {
      return 0;
    }

    const count: number = this.rects.length;

    if (!(count > 0)) {
      return 0;
    }

    return Math.floor(rng() * count);
  }

  private runEmitter(dt: number): void {
    let remaining: number = dt;
    let steps: number = 0;

    while (remaining > 0 && steps < MAX_LOOP_STEPS) {
      const duration: number = positiveOrZero(this.duration);

      let step: number = remaining;
      let wrapped: boolean = false;

      if (this.looping && duration > 0) {
        if (this.emitterTime >= duration) {
          this.emitterTime = 0;
          this.armBursts();
        }

        if (this.emitterTime + step >= duration) {
          step = duration - this.emitterTime;
          wrapped = true;
        }
      } else if (duration > 0 && this.emitterTime + step > duration) {
        step =
          duration - this.emitterTime > 0 ? duration - this.emitterTime : 0;
      }

      if (this.looping || this.emitterTime < duration) {
        this.runBursts(this.emitterTime + step);
        this.runRate(step);
      }

      this.emitterTime += step;
      remaining -= step;
      steps++;

      if (!wrapped) {
        break;
      }
    }
  }

  private runRate(dt: number): void {
    const rate: number = positiveOrZero(this.rate);

    if (rate === 0) {
      return;
    }

    this.rateAccumulator += rate * dt;

    while (this.rateAccumulator >= 1) {
      this.rateAccumulator -= 1;

      if (!this.spawnOne()) {
        this.rateAccumulator = 0;
        return;
      }
    }
  }

  private runBursts(to: number): void {
    for (let i: number = 0; i < this.burstList.length; i++) {
      const burst: ParticleBurst = this.burstList[i];
      const cycles: number = resolveCycles(burst.cycles);
      const interval: number =
        burst.interval !== undefined ? positiveOrZero(burst.interval) : 0;

      while (this.burstCyclesDone[i] < cycles && this.burstNextTime[i] < to) {
        const count: number = positiveOrZero(burst.count);

        for (let n: number = 0; n < count; n++) {
          if (!this.spawnOne()) {
            break;
          }
        }

        this.burstCyclesDone[i] += 1;

        if (interval > 0) {
          this.burstNextTime[i] += interval;
        }
      }
    }
  }

  private armBursts(): void {
    for (let i: number = 0; i < this.burstList.length; i++) {
      this.burstCyclesDone[i] = 0;
      this.burstNextTime[i] = positiveOrZero(this.burstList[i].time);
    }
  }

  private integrate(dt: number): void {
    const damping: number = 1 + positiveOrZero(this.drag) * dt;
    const gravityX: number = this.gravity.x;
    const gravityY: number = this.gravity.y;
    const ramp: Ramp<ParticleVector2> | null = this.velocityOverLifetime;

    let i: number = 0;

    while (i < this.living) {
      const lifetime: number = this.lifetimes[i];

      let accelerationX: number = gravityX;
      let accelerationY: number = gravityY;

      if (ramp !== null) {
        const eased: number = easingValue(ramp.easing, this.getLifeT(i));
        accelerationX += MathUtils.lerp(ramp.from.x, ramp.to.x, eased);
        accelerationY += MathUtils.lerp(ramp.from.y, ramp.to.y, eased);
      }

      const vx: number = (this.vxs[i] + accelerationX * dt) / damping;
      const vy: number = (this.vys[i] + accelerationY * dt) / damping;

      this.vxs[i] = vx;
      this.vys[i] = vy;
      this.xs[i] += vx * dt;
      this.ys[i] += vy * dt;
      this.rotations[i] += this.angularVelocities[i] * dt;

      const age: number = this.ages[i] + dt;
      this.ages[i] = age;

      if (age >= lifetime) {
        this.kill(i);
        continue;
      }

      i++;
    }
  }

  private kill(index: number): void {
    const last: number = this.living - 1;

    if (index !== last) {
      this.xs[index] = this.xs[last];
      this.ys[index] = this.ys[last];
      this.vxs[index] = this.vxs[last];
      this.vys[index] = this.vys[last];
      this.ages[index] = this.ages[last];
      this.lifetimes[index] = this.lifetimes[last];
      this.size0s[index] = this.size0s[last];
      this.rotations[index] = this.rotations[last];
      this.angularVelocities[index] = this.angularVelocities[last];
      this.r0s[index] = this.r0s[last];
      this.g0s[index] = this.g0s[last];
      this.b0s[index] = this.b0s[last];
      this.a0s[index] = this.a0s[last];
      this.frames[index] = this.frames[last];
    }

    this.living = last;
  }

  private spawnOne(): boolean {
    const limit: number = this.limit();

    if (this.living >= limit) {
      return false;
    }

    const index: number = this.living;
    const rng: () => number = this.rng;
    const lifetime: number = resolveScalar(this.startLifetime, rng);
    const speed: number = resolveScalar(this.startSpeed, rng);

    this.sampleShape(rng);

    let x: number = this.offsetX;
    let y: number = this.offsetY;

    if (this.simulationSpace === "world") {
      const m: Float32Array = this.worldMatrix.buffer;
      const worldX: number = m[0] * x + m[4] * y + m[12];
      const worldY: number = m[1] * x + m[5] * y + m[13];
      x = worldX;
      y = worldY;
    }

    this.xs[index] = x;
    this.ys[index] = y;
    this.vxs[index] = this.directionX * speed;
    this.vys[index] = this.directionY * speed;
    this.ages[index] = 0;
    this.lifetimes[index] = lifetime > 0 ? lifetime : MIN_LIFETIME;
    this.size0s[index] = resolveScalar(this.startSize, rng);
    this.rotations[index] = resolveScalar(this.startRotation, rng);
    this.angularVelocities[index] = resolveScalar(this.angularVelocity, rng);
    this.frames[index] = this.sampleFrame(rng);

    this.writeStartColor(index, rng);

    this.living = index + 1;

    return true;
  }

  private writeStartColor(index: number, rng: () => number): void {
    const range: ColorRange = this.startColor;

    if (range instanceof Color) {
      this.r0s[index] = range.r;
      this.g0s[index] = range.g;
      this.b0s[index] = range.b;
      this.a0s[index] = range.a;
      return;
    }

    const t: number = rng();

    this.r0s[index] = MathUtils.lerp(range.min.r, range.max.r, t);
    this.g0s[index] = MathUtils.lerp(range.min.g, range.max.g, t);
    this.b0s[index] = MathUtils.lerp(range.min.b, range.max.b, t);
    this.a0s[index] = MathUtils.lerp(range.min.a, range.max.a, t);
  }

  private sampleShape(rng: () => number): void {
    const shape: ParticleShape = this.shape;

    switch (shape.kind) {
      case "circle": {
        const angle: number = rng() * PI_2;
        const radius: number = positiveOrZero(shape.radius);
        const distance: number =
          shape.edgeOnly === true ? radius : radius * Math.sqrt(rng());

        this.directionX = Math.cos(angle);
        this.directionY = Math.sin(angle);
        this.offsetX = this.directionX * distance;
        this.offsetY = this.directionY * distance;
        return;
      }
      case "cone": {
        const spread: number = positiveOrZero(shape.angle);
        const base: number = shape.rotation !== undefined ? shape.rotation : 0;
        const angle: number = base + randomRange(-spread / 2, spread / 2, rng);
        const radius: number = positiveOrZero(shape.radius);

        this.directionX = Math.cos(angle);
        this.directionY = Math.sin(angle);
        this.offsetX = this.directionX * radius;
        this.offsetY = this.directionY * radius;
        return;
      }
      case "box": {
        const width: number = positiveOrZero(shape.width);
        const height: number = positiveOrZero(shape.height);
        const angle: number = rng() * PI_2;

        this.offsetX = randomRange(-width / 2, width / 2, rng);
        this.offsetY = randomRange(-height / 2, height / 2, rng);
        this.directionX = Math.cos(angle);
        this.directionY = Math.sin(angle);
        return;
      }
      case "edge": {
        const length: number = positiveOrZero(shape.length);
        const base: number = shape.rotation !== undefined ? shape.rotation : 0;
        const along: number = randomRange(-length / 2, length / 2, rng);
        const c: number = Math.cos(base);
        const s: number = Math.sin(base);

        this.offsetX = c * along;
        this.offsetY = s * along;
        this.directionX = -s;
        this.directionY = c;
        return;
      }
      default: {
        const angle: number = rng() * PI_2;

        this.offsetX = 0;
        this.offsetY = 0;
        this.directionX = Math.cos(angle);
        this.directionY = Math.sin(angle);
        return;
      }
    }
  }

  private limit(): number {
    const size: number = this.xs.length;
    const max: number = this.maxParticles;

    if (!Number.isFinite(max)) {
      return size;
    }

    if (!(max > 0)) {
      return 0;
    }

    const floored: number = Math.floor(max);

    return floored < size ? floored : size;
  }

  private static resize(
    source: Float32Array,
    size: number,
    kept: number,
  ): Float32Array {
    const target: Float32Array = new Float32Array(size);

    for (let i: number = 0; i < kept; i++) {
      target[i] = source[i];
    }

    return target;
  }
}
