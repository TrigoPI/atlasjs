import { describe, expect, it } from "vitest";

import { Easing, MathUtils } from "@atlasjs/math";

import type { AttackPose } from "../../../../../src/game/scripts/weapon/attacks/AttackPose";
import type {
  AttackCue,
  AttackPhase,
} from "../../../../../src/game/scripts/weapon/attacks/AttackTimeline";
import { AttackTimeline } from "../../../../../src/game/scripts/weapon/attacks/AttackTimeline";

function createPose(): AttackPose {
  return { angleOffset: 0, radiusScale: 0, scale: 0 };
}

function pokeNaN(pose: AttackPose): void {
  pose.angleOffset = Number.NaN;
  pose.radiusScale = Number.NaN;
  pose.scale = Number.NaN;
}

describe("AttackTimeline", () => {
  it("is instantiable with an empty phase list", () => {
    expect(() => new AttackTimeline([])).not.toThrow();
  });

  it("duration is the sum of the phase durations", () => {
    const timeline: AttackTimeline = new AttackTimeline([
      { name: "windup", duration: 0.09 },
      { name: "strike", duration: 0.18 },
      { name: "recover", duration: 0.2 },
    ]);

    expect(timeline.duration).toBeCloseTo(0.47);
  });

  it("duration of an empty phase list is 0", () => {
    const timeline: AttackTimeline = new AttackTimeline([]);
    expect(timeline.duration).toBe(0);
  });

  it("duration is stable across repeated reads", () => {
    const timeline: AttackTimeline = new AttackTimeline([
      { name: "strike", duration: 0.25 },
    ]);

    expect(timeline.duration).toBe(timeline.duration);
    expect(timeline.duration).toBeCloseTo(0.25);
  });

  it("lerps a single phase linearly when no easing is given", () => {
    const timeline: AttackTimeline = new AttackTimeline([
      { name: "strike", duration: 1, angleOffset: { from: 0, to: 10 } },
    ]);
    const pose: AttackPose = createPose();

    pokeNaN(pose);
    timeline.sample(0.25, pose);
    expect(pose.angleOffset).toBeCloseTo(2.5);

    pokeNaN(pose);
    timeline.sample(0.5, pose);
    expect(pose.angleOffset).toBeCloseTo(5);

    pokeNaN(pose);
    timeline.sample(1, pose);
    expect(pose.angleOffset).toBeCloseTo(10);
  });

  it("applies the phase easing to the local progress", () => {
    const timeline: AttackTimeline = new AttackTimeline([
      {
        name: "strike",
        duration: 1,
        angleOffset: { from: 0, to: 10, easing: Easing.outCubic },
      },
    ]);
    const pose: AttackPose = createPose();
    const expected: number = MathUtils.lerp(0, 10, Easing.outCubic(0.5));

    pokeNaN(pose);
    timeline.sample(0.5, pose);

    expect(pose.angleOffset).toBeCloseTo(expected);
    expect(pose.angleOffset).not.toBeCloseTo(5);
  });

  it("honours an explicit from over the carried value", () => {
    const timeline: AttackTimeline = new AttackTimeline([
      { name: "raise", duration: 1, scale: { from: 1, to: 2 } },
      { name: "drop", duration: 1, scale: { from: 5, to: 6 } },
    ]);
    const pose: AttackPose = createPose();

    pokeNaN(pose);
    timeline.sample(1, pose);
    expect(pose.scale).toBeCloseTo(5);

    pokeNaN(pose);
    timeline.sample(2, pose);
    expect(pose.scale).toBeCloseTo(6);
  });

  it("carries an implicit from off the previous phase that defines the channel", () => {
    const timeline: AttackTimeline = new AttackTimeline([
      { name: "extend", duration: 1, radiusScale: { from: 0.5, to: 1.8 } },
      { name: "retract", duration: 1, radiusScale: { to: 1 } },
    ]);
    const pose: AttackPose = createPose();

    pokeNaN(pose);
    timeline.sample(1, pose);
    expect(pose.radiusScale).toBeCloseTo(1.8);

    pokeNaN(pose);
    timeline.sample(1.5, pose);
    expect(pose.radiusScale).toBeCloseTo(MathUtils.lerp(1.8, 1, 0.5));

    pokeNaN(pose);
    timeline.sample(2, pose);
    expect(pose.radiusScale).toBeCloseTo(1);
  });

  it("carries an implicit from across an intervening phase that never mentions the channel", () => {
    const timeline: AttackTimeline = new AttackTimeline([
      { name: "extend", duration: 1, radiusScale: { from: 0.5, to: 1.8 } },
      { name: "hold", duration: 1 },
      { name: "retract", duration: 1, radiusScale: { to: 1 } },
    ]);
    const pose: AttackPose = createPose();

    pokeNaN(pose);
    timeline.sample(2, pose);
    expect(pose.radiusScale).toBe(1.8);

    pokeNaN(pose);
    timeline.sample(2.5, pose);
    expect(pose.radiusScale).toBeCloseTo(MathUtils.lerp(1.8, 1, 0.5));
  });

  it("falls back to the channel identity when no earlier phase defines it", () => {
    const timeline: AttackTimeline = new AttackTimeline([
      { name: "strike", duration: 1, angleOffset: { to: 4 } },
    ]);
    const pose: AttackPose = createPose();

    pokeNaN(pose);
    timeline.sample(0, pose);
    expect(pose.angleOffset).toBe(0);

    pokeNaN(pose);
    timeline.sample(0.5, pose);
    expect(pose.angleOffset).toBeCloseTo(2);
  });

  it("falls back to identity 1 for radiusScale and scale when no earlier phase defines them", () => {
    const timeline: AttackTimeline = new AttackTimeline([
      { name: "grow", duration: 1, radiusScale: { to: 3 }, scale: { to: 5 } },
    ]);
    const pose: AttackPose = createPose();

    pokeNaN(pose);
    timeline.sample(0, pose);

    expect(pose.radiusScale).toBe(1);
    expect(pose.scale).toBe(1);
  });

  it("holds the carried value constant for a phase that mentions no channel", () => {
    const timeline: AttackTimeline = new AttackTimeline([
      { name: "extend", duration: 1, radiusScale: { from: 0.5, to: 1.8 } },
      { name: "hold", duration: 1 },
    ]);
    const pose: AttackPose = createPose();

    pokeNaN(pose);
    timeline.sample(1, pose);
    expect(pose.radiusScale).toBe(1.8);

    pokeNaN(pose);
    timeline.sample(1.5, pose);
    expect(pose.radiusScale).toBe(1.8);

    pokeNaN(pose);
    timeline.sample(2 - 1e-9, pose);
    expect(pose.radiusScale).toBe(1.8);
  });

  it("holds a channel constant for a phase that only animates another channel", () => {
    const timeline: AttackTimeline = new AttackTimeline([
      { name: "extend", duration: 1, radiusScale: { from: 0.5, to: 1.8 } },
      { name: "sweep", duration: 1, angleOffset: { to: 2 } },
    ]);
    const pose: AttackPose = createPose();

    pokeNaN(pose);
    timeline.sample(1.5, pose);

    expect(pose.radiusScale).toBe(1.8);
    expect(pose.angleOffset).toBeCloseTo(1);
  });

  it("writes the identity value for a channel no phase ever mentions", () => {
    const timeline: AttackTimeline = new AttackTimeline([
      { name: "sweep", duration: 1, angleOffset: { from: 1, to: -1 } },
      { name: "recover", duration: 1, angleOffset: { to: 0 } },
    ]);
    const pose: AttackPose = createPose();

    for (let t: number = -0.5; t <= 2.5; t += 0.1) {
      pokeNaN(pose);
      timeline.sample(t, pose);

      expect(pose.radiusScale).toBe(1);
      expect(pose.scale).toBe(1);
    }
  });

  it("is continuous at a phase boundary", () => {
    const timeline: AttackTimeline = new AttackTimeline([
      {
        name: "strike",
        duration: 0.09,
        angleOffset: { from: 1, to: -2, easing: Easing.outCubic },
      },
      {
        name: "recover",
        duration: 0.18,
        angleOffset: { to: 0, easing: Easing.inOutQuad },
      },
    ]);
    const pose: AttackPose = createPose();

    pokeNaN(pose);
    timeline.sample(0.09 - 1e-9, pose);
    const beforeBoundary: number = pose.angleOffset;

    pokeNaN(pose);
    timeline.sample(0.09, pose);
    const atBoundary: number = pose.angleOffset;

    expect(atBoundary).toBe(-2);
    expect(beforeBoundary).toBeCloseTo(-2, 6);
  });

  it("clamps t below 0 to the first phase at progress 0", () => {
    const timeline: AttackTimeline = new AttackTimeline([
      { name: "strike", duration: 1, angleOffset: { from: 3, to: 9 } },
      { name: "recover", duration: 1, angleOffset: { to: 0 } },
    ]);
    const pose: AttackPose = createPose();

    pokeNaN(pose);
    timeline.sample(0, pose);
    const atZero: number = pose.angleOffset;

    pokeNaN(pose);
    timeline.sample(-5, pose);

    expect(pose.angleOffset).toBe(atZero);
    expect(pose.angleOffset).toBe(3);
  });

  it("clamps t past duration to the last phase at progress 1", () => {
    const timeline: AttackTimeline = new AttackTimeline([
      { name: "strike", duration: 1, angleOffset: { from: 3, to: 9 } },
      { name: "recover", duration: 1, angleOffset: { to: 0 } },
    ]);
    const pose: AttackPose = createPose();

    pokeNaN(pose);
    timeline.sample(2, pose);
    const atDuration: number = pose.angleOffset;

    pokeNaN(pose);
    timeline.sample(1000, pose);

    expect(pose.angleOffset).toBe(atDuration);
    expect(pose.angleOffset).toBe(0);
  });

  it("resolves a zero-duration phase to progress 1 without NaN", () => {
    const timeline: AttackTimeline = new AttackTimeline([
      { name: "snap", duration: 0, angleOffset: { from: 0, to: 7 } },
    ]);
    const pose: AttackPose = createPose();

    expect(timeline.duration).toBe(0);

    pokeNaN(pose);
    timeline.sample(0, pose);
    expect(Number.isNaN(pose.angleOffset)).toBe(false);
    expect(pose.angleOffset).toBe(0);

    pokeNaN(pose);
    timeline.sample(0.5, pose);
    expect(Number.isNaN(pose.angleOffset)).toBe(false);
    expect(pose.angleOffset).toBe(7);
  });

  it("skips an interior zero-duration phase while still carrying its value", () => {
    const timeline: AttackTimeline = new AttackTimeline([
      { name: "extend", duration: 1, radiusScale: { from: 0.5, to: 1.8 } },
      { name: "snap", duration: 0, radiusScale: { to: 3 } },
      { name: "retract", duration: 1, radiusScale: { to: 1 } },
    ]);
    const pose: AttackPose = createPose();

    expect(timeline.duration).toBe(2);

    pokeNaN(pose);
    timeline.sample(1, pose);
    expect(pose.radiusScale).toBe(3);

    pokeNaN(pose);
    timeline.sample(1.5, pose);
    expect(pose.radiusScale).toBeCloseTo(MathUtils.lerp(3, 1, 0.5));
  });

  it("writes identity values for an empty phase list", () => {
    const timeline: AttackTimeline = new AttackTimeline([]);
    const pose: AttackPose = createPose();

    for (const t of [-1, 0, 0.5, 10]) {
      pokeNaN(pose);
      timeline.sample(t, pose);

      expect(pose.angleOffset).toBe(0);
      expect(pose.radiusScale).toBe(1);
      expect(pose.scale).toBe(1);
    }
  });

  it("writes every pose channel on every sample", () => {
    const timeline: AttackTimeline = new AttackTimeline([
      {
        name: "strike",
        duration: 0.09,
        angleOffset: { from: 1, to: -2, easing: Easing.outCubic },
      },
      { name: "hold", duration: 0.05 },
      { name: "recover", duration: 0.18, angleOffset: { to: 0 } },
    ]);
    const pose: AttackPose = createPose();

    for (let t: number = -0.2; t <= timeline.duration + 0.2; t += 0.005) {
      pokeNaN(pose);
      timeline.sample(t, pose);

      expect(Number.isNaN(pose.angleOffset)).toBe(false);
      expect(Number.isNaN(pose.radiusScale)).toBe(false);
      expect(Number.isNaN(pose.scale)).toBe(false);
    }
  });

  it("yields identical values when the same t is sampled twice", () => {
    const timeline: AttackTimeline = new AttackTimeline([
      {
        name: "strike",
        duration: 0.09,
        angleOffset: { from: 1, to: -2, easing: Easing.outCubic },
        radiusScale: { to: 1.4 },
      },
      { name: "hold", duration: 0.05 },
      {
        name: "recover",
        duration: 0.18,
        angleOffset: { to: 0 },
        radiusScale: { to: 1 },
      },
    ]);
    const first: AttackPose = createPose();
    const second: AttackPose = createPose();

    timeline.sample(0.11, first);
    timeline.sample(0.11, second);

    expect(second.angleOffset).toBe(first.angleOffset);
    expect(second.radiusScale).toBe(first.radiusScale);
    expect(second.scale).toBe(first.scale);
  });

  it("is order independent: sampling late then early matches sampling in order", () => {
    const phases: readonly AttackPhase[] = [
      {
        name: "strike",
        duration: 0.09,
        angleOffset: { from: 1, to: -2, easing: Easing.outCubic },
        radiusScale: { to: 1.4 },
      },
      { name: "hold", duration: 0.05 },
      {
        name: "recover",
        duration: 0.18,
        angleOffset: { to: 0, easing: Easing.inOutQuad },
        radiusScale: { to: 1 },
      },
    ];
    const inOrder: AttackTimeline = new AttackTimeline(phases);
    const reversed: AttackTimeline = new AttackTimeline(phases);
    const samples: readonly number[] = [0, 0.04, 0.09, 0.12, 0.2, 0.32];
    const expected: AttackPose[] = [];

    for (const t of samples) {
      const pose: AttackPose = createPose();
      inOrder.sample(t, pose);
      expected.push(pose);
    }

    for (let i: number = samples.length - 1; i >= 0; i -= 1) {
      const pose: AttackPose = createPose();
      reversed.sample(samples[i], pose);

      expect(pose.angleOffset).toBe(expected[i].angleOffset);
      expect(pose.radiusScale).toBe(expected[i].radiusScale);
      expect(pose.scale).toBe(expected[i].scale);
    }
  });

  it("does not mutate the phase list it was given", () => {
    const tween: { from?: number; to: number } = { to: 1.8 };
    const phases: AttackPhase[] = [
      { name: "extend", duration: 1, radiusScale: tween },
    ];
    const timeline: AttackTimeline = new AttackTimeline(phases);
    const pose: AttackPose = createPose();

    timeline.sample(0.5, pose);

    expect(tween.from).toBeUndefined();
    expect(phases[0].duration).toBe(1);
  });

  describe("AttackTimeline cues", () => {
    function cuedTimeline(): AttackTimeline {
      return new AttackTimeline([
        { name: "a", duration: 0.1, cue: { rearmHits: true } },
        { name: "b", duration: 0.1 },
        { name: "c", duration: 0.1, cue: { sound: { pitch: 1.5 } } },
      ]);
    }

    it("pushes nothing when no phase carries a cue", () => {
      const timeline: AttackTimeline = new AttackTimeline([
        { name: "a", duration: 0.1 },
        { name: "b", duration: 0.1 },
      ]);
      const out: AttackCue[] = [];

      timeline.collectCues(-1, 10, out);

      expect(out).toHaveLength(0);
    });

    it("fires the phase starting at 0 only when fromT is below 0", () => {
      const timeline: AttackTimeline = cuedTimeline();
      const out: AttackCue[] = [];

      timeline.collectCues(-1, 0.01, out);
      expect(out).toHaveLength(1);
      expect(out[0].rearmHits).toBe(true);

      out.length = 0;
      timeline.collectCues(0, 0.01, out);
      expect(out).toHaveLength(0);
    });

    it("does not re-fire a cue already consumed by an earlier window", () => {
      const timeline: AttackTimeline = cuedTimeline();
      const out: AttackCue[] = [];

      timeline.collectCues(-1, 0.05, out);
      expect(out).toHaveLength(1);
      expect(out[0].rearmHits).toBe(true);

      out.length = 0;
      timeline.collectCues(0.0, 0.25, out);
      expect(out).toHaveLength(1);
      expect(out[0].sound?.pitch).toBe(1.5);
    });

    it("fires phases with identical start times in declaration order within a single collectCues call", () => {
      const timeline: AttackTimeline = new AttackTimeline([
        { name: "start-only", duration: 0, cue: { rearmHits: true } },
        {
          name: "immediate-next",
          duration: 0,
          cue: { sound: { volume: 0.5 } },
        },
        { name: "normal", duration: 0.1 },
      ]);
      const out: AttackCue[] = [];

      timeline.collectCues(-0.1, 0.05, out);

      expect(out).toHaveLength(2);
      expect(out[0].rearmHits).toBe(true);
      expect(out[1].sound?.volume).toBe(0.5);
    });

    it("treats the low bound as exclusive and the high bound as inclusive", () => {
      const timeline: AttackTimeline = cuedTimeline();
      const out: AttackCue[] = [];

      // phase "c" starts at 0.2 exactly.
      timeline.collectCues(0.1, 0.2, out);
      expect(out).toHaveLength(1);
      expect(out[0].sound?.pitch).toBe(1.5);

      out.length = 0;
      timeline.collectCues(0.2, 0.3, out);
      expect(out).toHaveLength(0);
    });

    it("pushes every cue crossed by a long frame, in chronological order", () => {
      const timeline: AttackTimeline = cuedTimeline();
      const out: AttackCue[] = [];

      timeline.collectCues(-1, 10, out);

      expect(out).toHaveLength(2);
      expect(out[0].rearmHits).toBe(true);
      expect(out[1].sound?.pitch).toBe(1.5);
    });

    it("appends to the array without clearing it — the caller owns it", () => {
      const timeline: AttackTimeline = cuedTimeline();
      const out: AttackCue[] = [{ rearmHits: false }];

      timeline.collectCues(-1, 0.01, out);

      expect(out).toHaveLength(2);
    });

    it("is safe on an empty phase list", () => {
      const timeline: AttackTimeline = new AttackTimeline([]);
      const out: AttackCue[] = [];

      expect(() => timeline.collectCues(-1, 10, out)).not.toThrow();
      expect(out).toHaveLength(0);
    });

    it("hasSoundCue is true only when at least one cue carries a sound", () => {
      expect(cuedTimeline().hasSoundCue).toBe(true);

      const rearmOnly: AttackTimeline = new AttackTimeline([
        { name: "a", duration: 0.1, cue: { rearmHits: true } },
      ]);
      expect(rearmOnly.hasSoundCue).toBe(false);

      const bare: AttackTimeline = new AttackTimeline([
        { name: "a", duration: 0.1 },
      ]);
      expect(bare.hasSoundCue).toBe(false);
    });
  });

  describe("expressing the shipped ThrustAttack as a timeline", () => {
    const THRUST_DURATION: number = 0.07;
    const HOLD_DURATION: number = 0.05;
    const RECOVER_DURATION: number = 0.2;
    const PULLBACK_RADIUS: number = 0.55;
    const THRUST_RADIUS: number = 1.85;

    const HOLD_START: number = THRUST_DURATION;
    const RECOVER_START: number = THRUST_DURATION + HOLD_DURATION;

    function createThrustTimeline(): AttackTimeline {
      return new AttackTimeline([
        {
          name: "thrust",
          duration: THRUST_DURATION,
          radiusScale: {
            from: PULLBACK_RADIUS,
            to: THRUST_RADIUS,
            easing: Easing.outCubic,
          },
        },
        { name: "hold", duration: HOLD_DURATION },
        {
          name: "recover",
          duration: RECOVER_DURATION,
          radiusScale: { to: 1, easing: Easing.inOutQuad },
        },
      ]);
    }

    it("duration is the sum of the three phases", () => {
      const timeline: AttackTimeline = createThrustTimeline();
      expect(timeline.duration).toBeCloseTo(
        THRUST_DURATION + HOLD_DURATION + RECOVER_DURATION,
      );
    });

    it("keeps angleOffset at 0 and scale at 1 across the whole timeline", () => {
      const timeline: AttackTimeline = createThrustTimeline();
      const pose: AttackPose = createPose();

      for (let t: number = 0; t <= timeline.duration + 1; t += 0.01) {
        pokeNaN(pose);
        timeline.sample(t, pose);

        expect(pose.angleOffset).toBe(0);
        expect(pose.scale).toBe(1);
      }
    });

    it("starts already pulled back to pullbackRadius", () => {
      const timeline: AttackTimeline = createThrustTimeline();
      const pose: AttackPose = createPose();

      pokeNaN(pose);
      timeline.sample(0, pose);

      expect(pose.radiusScale).toBeCloseTo(PULLBACK_RADIUS);
    });

    it("thrust phase mid-point locks the outCubic curve identity", () => {
      const timeline: AttackTimeline = createThrustTimeline();
      const pose: AttackPose = createPose();
      const expected: number = MathUtils.lerp(
        PULLBACK_RADIUS,
        THRUST_RADIUS,
        Easing.outCubic(0.5),
      );

      pokeNaN(pose);
      timeline.sample(THRUST_DURATION / 2, pose);

      expect(pose.radiusScale).toBeGreaterThan(PULLBACK_RADIUS);
      expect(pose.radiusScale).toBeLessThan(THRUST_RADIUS);
      expect(pose.radiusScale).toBeCloseTo(expected);
    });

    it("thrust phase reaches thrustRadius by its end", () => {
      const timeline: AttackTimeline = createThrustTimeline();
      const pose: AttackPose = createPose();

      pokeNaN(pose);
      timeline.sample(THRUST_DURATION - 1e-6, pose);

      expect(pose.radiusScale).toBeCloseTo(THRUST_RADIUS, 2);
    });

    it("hold phase keeps radiusScale exactly at thrustRadius", () => {
      const timeline: AttackTimeline = createThrustTimeline();
      const pose: AttackPose = createPose();

      pokeNaN(pose);
      timeline.sample(HOLD_START, pose);
      expect(pose.radiusScale).toBe(THRUST_RADIUS);

      pokeNaN(pose);
      timeline.sample(HOLD_START + HOLD_DURATION / 2, pose);
      expect(pose.radiusScale).toBe(THRUST_RADIUS);

      pokeNaN(pose);
      timeline.sample(RECOVER_START - 1e-6, pose);
      expect(pose.radiusScale).toBe(THRUST_RADIUS);
    });

    it("recover phase mid-point locks the inOutQuad curve identity", () => {
      const timeline: AttackTimeline = createThrustTimeline();
      const pose: AttackPose = createPose();
      const expected: number = MathUtils.lerp(
        THRUST_RADIUS,
        1,
        Easing.inOutQuad(0.5),
      );

      pokeNaN(pose);
      timeline.sample(RECOVER_START + RECOVER_DURATION / 2, pose);

      expect(pose.radiusScale).toBeCloseTo(expected);
    });

    it("recover phase returns radiusScale to 1 by t=duration", () => {
      const timeline: AttackTimeline = createThrustTimeline();
      const pose: AttackPose = createPose();

      pokeNaN(pose);
      timeline.sample(timeline.duration, pose);

      expect(pose.radiusScale).toBeCloseTo(1);
    });

    it("clamps past duration without NaN or drift", () => {
      const timeline: AttackTimeline = createThrustTimeline();
      const pose: AttackPose = createPose();

      pokeNaN(pose);
      timeline.sample(timeline.duration + 5, pose);

      expect(Number.isNaN(pose.radiusScale)).toBe(false);
      expect(pose.radiusScale).toBeCloseTo(1);
    });
  });
});
