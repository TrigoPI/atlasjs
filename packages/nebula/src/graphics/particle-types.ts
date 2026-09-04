import { BlendMode } from "../core";
import { Color } from "../utils";

export type ScalarRange =
  | number
  | { readonly min: number; readonly max: number };

export type ColorRange = Color | { readonly min: Color; readonly max: Color };

export type EasingName =
  | "linear"
  | "inOutQuad"
  | "outCubic"
  | "outQuint"
  | "spring"
  | "outBack";

export type Ramp<T> = {
  readonly from: T;
  readonly to: T;
  readonly easing?: EasingName;
};

export type ParticleVector2 = {
  readonly x: number;
  readonly y: number;
};

export type ParticleBurst = {
  readonly time: number;
  readonly count: number;
  readonly cycles?: number;
  readonly interval?: number;
};

export type ParticleShape =
  | { readonly kind: "point" }
  | {
      readonly kind: "circle";
      readonly radius: number;
      readonly edgeOnly?: boolean;
    }
  | {
      readonly kind: "cone";
      readonly angle: number;
      readonly radius: number;
      readonly rotation?: number;
    }
  | { readonly kind: "box"; readonly width: number; readonly height: number }
  | {
      readonly kind: "edge";
      readonly length: number;
      readonly rotation?: number;
    };

export type ParticleTextureSheet =
  | { readonly mode: "overLifetime"; readonly cycles?: number }
  | { readonly mode: "randomFrame" };

export type ParticleSimulationSpace = "local" | "world";

export type ParticleAlignment = "fixed" | "velocity";

export type ParticleState = "stopped" | "playing" | "paused";

export type ParticleEmitterConfig = {
  readonly duration?: number;
  readonly looping?: boolean;
  readonly prewarm?: boolean;
  readonly maxParticles?: number;
  readonly rate?: number;
  readonly bursts?: readonly ParticleBurst[];
  readonly shape?: ParticleShape;
  readonly startLifetime?: ScalarRange;
  readonly startSpeed?: ScalarRange;
  readonly startSize?: ScalarRange;
  readonly startRotation?: ScalarRange;
  readonly startColor?: ColorRange;
  readonly angularVelocity?: ScalarRange;
  readonly gravity?: ParticleVector2;
  readonly drag?: number;
  readonly sizeOverLifetime?: Ramp<number>;
  readonly colorOverLifetime?: Ramp<Color>;
  readonly velocityOverLifetime?: Ramp<ParticleVector2>;
  readonly simulationSpace?: ParticleSimulationSpace;
  readonly alignment?: ParticleAlignment;
  readonly blend?: BlendMode;
  readonly textureSheet?: ParticleTextureSheet;
  readonly seed?: number;
};
