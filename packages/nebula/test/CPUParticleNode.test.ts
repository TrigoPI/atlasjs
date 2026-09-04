import { Easing, Vec4 } from "@atlasjs/math";
import { describe, expect, it } from "vitest";
import { CPUParticleNode } from "../src/graphics/CPUParticleNode";
import type {
  EasingName,
  ParticleBurst,
  ParticleEmitterConfig,
  ParticleShape,
} from "../src/graphics/particle-types";
import { Color } from "../src/utils/Color";

const STEP: number = 1 / 60;

function still(overrides: ParticleEmitterConfig = {}): CPUParticleNode {
  return new CPUParticleNode({
    rate: 0,
    startSpeed: 0,
    startLifetime: 100,
    startSize: 1,
    duration: 1000,
    looping: false,
    maxParticles: 64,
    ...overrides,
  });
}

describe("CPUParticleNode rate", () => {
  it("spawns about rate x seconds particles over the emitter window", () => {
    const node: CPUParticleNode = still({ rate: 10, duration: 100 });
    node.play();

    for (let i: number = 0; i < 20; i++) {
      node.advance(0.1);
    }

    expect(node.aliveCount).toBeGreaterThanOrEqual(19);
    expect(node.aliveCount).toBeLessThanOrEqual(21);
  });

  it("keeps emitting across loop cycles", () => {
    const node: CPUParticleNode = still({
      rate: 10,
      duration: 0.5,
      looping: true,
      maxParticles: 200,
    });
    node.play();

    for (let i: number = 0; i < 20; i++) {
      node.advance(0.1);
    }

    expect(node.isEmitting).toBe(true);
    expect(node.aliveCount).toBeGreaterThanOrEqual(18);
    expect(node.aliveCount).toBeLessThanOrEqual(22);
  });

  it("stops emitting past duration when not looping", () => {
    const node: CPUParticleNode = still({
      rate: 10,
      duration: 0.5,
      looping: false,
      maxParticles: 200,
    });
    node.play();

    for (let i: number = 0; i < 20; i++) {
      node.advance(0.1);
    }

    expect(node.isEmitting).toBe(false);
    expect(node.aliveCount).toBeGreaterThanOrEqual(4);
    expect(node.aliveCount).toBeLessThanOrEqual(6);
  });
});

describe("CPUParticleNode bursts", () => {
  it("fires a burst at its time and only once by default", () => {
    const node: CPUParticleNode = still({
      duration: 10,
      bursts: [{ time: 0.5, count: 5 }],
    });
    node.play();
    node.advance(0.4);

    expect(node.aliveCount).toEqual(0);

    node.advance(0.2);

    expect(node.aliveCount).toEqual(5);

    node.advance(1);

    expect(node.aliveCount).toEqual(5);
  });

  it("re-fires each cycle spaced by interval", () => {
    const node: CPUParticleNode = still({
      duration: 10,
      bursts: [{ time: 0, count: 2, cycles: 3, interval: 0.5 }],
    });
    node.play();
    node.advance(0.1);

    expect(node.aliveCount).toEqual(2);

    node.advance(0.5);

    expect(node.aliveCount).toEqual(4);

    node.advance(0.5);

    expect(node.aliveCount).toEqual(6);

    node.advance(2);

    expect(node.aliveCount).toEqual(6);
  });

  it("re-arms bursts on the next loop cycle", () => {
    const node: CPUParticleNode = still({
      duration: 1,
      looping: true,
      bursts: [{ time: 0.5, count: 3 }],
    });
    node.play();

    for (let i: number = 0; i < 10; i++) {
      node.advance(0.1);
    }

    expect(node.aliveCount).toEqual(3);

    for (let i: number = 0; i < 10; i++) {
      node.advance(0.1);
    }

    expect(node.aliveCount).toEqual(6);
  });

  it("re-arms when the bursts array reference changes, not on every write", () => {
    const list: readonly ParticleBurst[] = [{ time: 0.5, count: 3 }];
    const node: CPUParticleNode = still({ duration: 10 });
    node.bursts = list;
    node.play();
    node.advance(0.6);

    expect(node.aliveCount).toEqual(3);

    node.bursts = list;
    node.advance(0.1);

    expect(node.aliveCount).toEqual(3);

    node.bursts = [{ time: 0, count: 4 }];
    node.advance(0.1);

    expect(node.aliveCount).toEqual(7);
  });
});

describe("CPUParticleNode lifetime", () => {
  it("kills a particle once its age reaches its lifetime", () => {
    const node: CPUParticleNode = still({ startLifetime: 0.5 });
    node.emit(3);

    expect(node.aliveCount).toEqual(3);

    node.advance(0.4);

    expect(node.aliveCount).toEqual(3);

    node.advance(0.2);

    expect(node.aliveCount).toEqual(0);
  });

  it("reports the normalized life as a ratio of age over lifetime", () => {
    const node: CPUParticleNode = still({ startLifetime: 2 });
    node.emit(1);
    node.advance(0.5);

    expect(node.getLifeT(0)).toBeCloseTo(0.25, 6);
  });
});

describe("CPUParticleNode capacity ceiling", () => {
  it("never exceeds maxParticles", () => {
    const node: CPUParticleNode = still({ rate: 1000, maxParticles: 4 });
    node.play();

    for (let i: number = 0; i < 10; i++) {
      node.advance(0.1);
    }

    expect(node.aliveCount).toEqual(4);
    expect(node.capacity).toEqual(4);
  });

  it("never exceeds maxParticles through emit either", () => {
    const node: CPUParticleNode = still({ maxParticles: 3 });
    node.emit(100);

    expect(node.aliveCount).toEqual(3);
  });
});

describe("CPUParticleNode recycling", () => {
  it("keeps the array dense and still integrates the swapped-in particle", () => {
    const node: CPUParticleNode = still();

    node.startLifetime = 1;
    node.startSize = 10;
    node.emit(1);

    node.startLifetime = 0.1;
    node.startSize = 20;
    node.emit(1);

    node.startLifetime = 1;
    node.startSize = 30;
    node.emit(1);

    node.advance(0.2);

    expect(node.aliveCount).toEqual(2);
    expect(node.getSize(0)).toEqual(10);
    expect(node.getSize(1)).toEqual(30);
    expect(node.getLifeT(0)).toBeCloseTo(0.2, 6);
    expect(node.getLifeT(1)).toBeCloseTo(0.2, 6);
  });

  it("empties fully when every particle dies in the same frame", () => {
    const node: CPUParticleNode = still({ startLifetime: 0.1 });
    node.emit(5);
    node.advance(0.5);

    expect(node.aliveCount).toEqual(0);
  });
});

describe("CPUParticleNode integration", () => {
  it("accelerates velocity and position with gravity", () => {
    const node: CPUParticleNode = still({ gravity: { x: 0, y: -100 } });
    node.emit(1);
    node.advance(0.1);

    expect(node.getVelocityY(0)).toBeCloseTo(-10, 6);
    expect(node.getY(0)).toBeCloseTo(-1, 6);
  });

  it("damps velocity with drag without ever reversing it", () => {
    const node: CPUParticleNode = still({
      gravity: { x: 0, y: -100 },
      drag: 1,
    });
    node.emit(1);
    node.advance(0.1);

    expect(node.getVelocityY(0)).toBeCloseTo(-10 / 1.1, 6);

    const strong: CPUParticleNode = still({
      gravity: { x: 0, y: -100 },
      drag: 100,
    });
    strong.emit(1);
    strong.advance(0.1);

    expect(strong.getVelocityY(0)).toBeCloseTo(-10 / 11, 6);
    expect(strong.getVelocityY(0)).toBeLessThan(0);
  });

  it("spins a particle with its angular velocity", () => {
    const node: CPUParticleNode = still({
      startRotation: 1,
      angularVelocity: 2,
    });
    node.emit(1);
    node.advance(0.5);

    expect(node.getRotation(0)).toBeCloseTo(2, 6);
  });

  it("ignores a non-positive or non-finite dt", () => {
    const node: CPUParticleNode = still({ gravity: { x: 0, y: -100 } });
    node.emit(1);

    const y: number = node.getY(0);
    const vy: number = node.getVelocityY(0);

    node.advance(0);
    node.advance(-1);
    node.advance(NaN);

    expect(node.aliveCount).toEqual(1);
    expect(node.getY(0)).toEqual(y);
    expect(node.getVelocityY(0)).toEqual(vy);
    expect(node.getLifeT(0)).toEqual(0);
  });
});

describe("CPUParticleNode ramps", () => {
  it("multiplies the randomized start size by sizeOverLifetime", () => {
    const node: CPUParticleNode = still({
      startLifetime: 1,
      startSize: 10,
      sizeOverLifetime: { from: 1, to: 0 },
    });
    node.emit(1);

    expect(node.getSize(0)).toBeCloseTo(10, 6);

    node.advance(0.5);

    expect(node.getSize(0)).toBeCloseTo(5, 6);
  });

  it("multiplies the start color by colorOverLifetime and writes into out", () => {
    const node: CPUParticleNode = still({
      startLifetime: 1,
      startColor: new Color(1, 0.5, 0.25, 1),
      colorOverLifetime: {
        from: new Color(1, 1, 1, 1),
        to: new Color(1, 1, 1, 0),
      },
    });
    node.emit(1);
    node.advance(0.5);

    const out: Vec4 = new Vec4();
    const returned: Vec4 = node.getColor(0, out);

    expect(returned).toBe(out);
    expect(out.x).toBeCloseTo(1, 6);
    expect(out.y).toBeCloseTo(0.5, 6);
    expect(out.z).toBeCloseTo(0.25, 6);
    expect(out.w).toBeCloseTo(0.5, 6);
  });

  it("returns the raw start color when there is no color ramp", () => {
    const node: CPUParticleNode = still({
      startColor: new Color(0.25, 0.5, 0.75, 0.5),
    });
    node.emit(1);

    const out: Vec4 = new Vec4();
    node.getColor(0, out);

    expect(out.x).toBeCloseTo(0.25, 6);
    expect(out.y).toBeCloseTo(0.5, 6);
    expect(out.z).toBeCloseTo(0.75, 6);
    expect(out.w).toBeCloseTo(0.5, 6);
  });

  it("applies velocityOverLifetime as an additive acceleration", () => {
    const node: CPUParticleNode = still({
      velocityOverLifetime: { from: { x: 100, y: 0 }, to: { x: 100, y: 0 } },
    });
    node.emit(1);
    node.advance(0.1);

    expect(node.getVelocityX(0)).toBeCloseTo(10, 6);

    node.advance(0.1);

    expect(node.getVelocityX(0)).toBeCloseTo(20, 6);
  });

  it("resolves every easing name", () => {
    const expected: Record<EasingName, number> = {
      linear: 0.5,
      inOutQuad: Easing.inOutQuad(0.5),
      outCubic: Easing.outCubic(0.5),
      outQuint: Easing.outQuint(0.5),
      spring: Easing.spring(0.5),
      outBack: Easing.outBack(0.5),
    };
    const names: readonly EasingName[] = [
      "linear",
      "inOutQuad",
      "outCubic",
      "outQuint",
      "spring",
      "outBack",
    ];

    for (let i: number = 0; i < names.length; i++) {
      const name: EasingName = names[i];
      const node: CPUParticleNode = still({
        startLifetime: 1,
        startSize: 10,
        sizeOverLifetime: { from: 0, to: 1, easing: name },
      });
      node.emit(1);
      node.advance(0.5);

      expect(node.getSize(0)).toBeCloseTo(10 * expected[name], 5);
    }
  });
});

describe("CPUParticleNode state machine", () => {
  it("stop halts emission but lets living particles die naturally", () => {
    const node: CPUParticleNode = still({
      rate: 100,
      duration: 100,
      startLifetime: 0.5,
      maxParticles: 200,
    });
    node.play();
    node.advance(0.1);

    const spawned: number = node.aliveCount;

    expect(spawned).toBeGreaterThan(0);

    node.stop();

    expect(node.isEmitting).toBe(false);
    expect(node.state).toBe("stopped");

    node.advance(0.1);

    expect(node.aliveCount).toEqual(spawned);

    node.advance(1);

    expect(node.aliveCount).toEqual(0);
    expect(node.isAlive).toBe(false);
  });

  it("clear kills every particle instantly and leaves the state alone", () => {
    const node: CPUParticleNode = still({ rate: 100, duration: 100 });
    node.play();
    node.advance(0.1);

    expect(node.aliveCount).toBeGreaterThan(0);

    node.clear();

    expect(node.aliveCount).toEqual(0);
    expect(node.state).toBe("playing");
    expect(node.isAlive).toBe(true);
  });

  it("pause freezes emission and integration", () => {
    const node: CPUParticleNode = still({
      rate: 10,
      duration: 100,
      gravity: { x: 0, y: -100 },
    });
    node.play();
    node.advance(0.2);

    const spawned: number = node.aliveCount;
    const y: number = node.getY(0);

    expect(spawned).toBeGreaterThan(0);

    node.pause();
    node.advance(1);

    expect(node.state).toBe("paused");
    expect(node.isEmitting).toBe(false);
    expect(node.aliveCount).toEqual(spawned);
    expect(node.getY(0)).toEqual(y);
  });

  it("play resets the emitter clock and re-arms the bursts", () => {
    const node: CPUParticleNode = still({
      duration: 10,
      bursts: [{ time: 0, count: 2 }],
    });
    node.play();
    node.advance(0.1);

    expect(node.aliveCount).toEqual(2);

    node.play();
    node.advance(0.1);

    expect(node.aliveCount).toEqual(4);
    expect(node.state).toBe("playing");
  });

  it("emit force-spawns while stopped", () => {
    const node: CPUParticleNode = still();

    expect(node.state).toBe("stopped");

    node.emit(3);

    expect(node.aliveCount).toEqual(3);
  });

  it("prewarm starts a looping emitter non-empty", () => {
    const cold: CPUParticleNode = still({
      rate: 10,
      duration: 1,
      looping: true,
      prewarm: false,
      maxParticles: 200,
    });
    cold.play();

    expect(cold.aliveCount).toEqual(0);

    const warm: CPUParticleNode = still({
      rate: 10,
      duration: 1,
      looping: true,
      prewarm: true,
      maxParticles: 200,
    });
    warm.play();

    expect(warm.aliveCount).toBeGreaterThanOrEqual(9);
    expect(warm.aliveCount).toBeLessThanOrEqual(11);
  });
});

describe("CPUParticleNode shapes", () => {
  it("spawns a point shape at the origin", () => {
    const node: CPUParticleNode = still({ shape: { kind: "point" } });
    node.emit(1);

    expect(node.getX(0)).toEqual(0);
    expect(node.getY(0)).toEqual(0);
  });

  it("spawns a circle edgeOnly shape exactly on the rim", () => {
    const node: CPUParticleNode = still({
      shape: { kind: "circle", radius: 10, edgeOnly: true },
    });
    node.emit(32);

    for (let i: number = 0; i < node.aliveCount; i++) {
      const x: number = node.getX(i);
      const y: number = node.getY(i);

      expect(Math.sqrt(x * x + y * y)).toBeCloseTo(10, 4);
    }
  });

  it("spawns a filled circle inside the radius with a sqrt distribution", () => {
    const node: CPUParticleNode = still({
      shape: { kind: "circle", radius: 10 },
      seed: 7,
      maxParticles: 512,
    });
    node.emit(512);

    let inner: number = 0;

    for (let i: number = 0; i < node.aliveCount; i++) {
      const x: number = node.getX(i);
      const y: number = node.getY(i);
      const d: number = Math.sqrt(x * x + y * y);

      expect(d).toBeLessThanOrEqual(10.001);

      if (d <= 5) {
        inner++;
      }
    }

    expect(inner / node.aliveCount).toBeGreaterThan(0.15);
    expect(inner / node.aliveCount).toBeLessThan(0.35);
  });

  it("spawns a cone within its half angle of its rotation", () => {
    const node: CPUParticleNode = still({
      shape: { kind: "cone", angle: Math.PI / 2, radius: 5, rotation: 0 },
      startSpeed: 100,
      maxParticles: 64,
    });
    node.emit(64);

    for (let i: number = 0; i < node.aliveCount; i++) {
      const angle: number = Math.atan2(
        node.getVelocityY(i),
        node.getVelocityX(i),
      );

      expect(Math.abs(angle)).toBeLessThanOrEqual(Math.PI / 4 + 1e-6);
      expect(Math.sqrt(node.getX(i) ** 2 + node.getY(i) ** 2)).toBeCloseTo(
        5,
        4,
      );
    }
  });

  it("spawns a box uniformly inside its extents", () => {
    const node: CPUParticleNode = still({
      shape: { kind: "box", width: 20, height: 10 },
      maxParticles: 64,
    });
    node.emit(64);

    for (let i: number = 0; i < node.aliveCount; i++) {
      expect(Math.abs(node.getX(i))).toBeLessThanOrEqual(10.001);
      expect(Math.abs(node.getY(i))).toBeLessThanOrEqual(5.001);
    }
  });

  it("spawns an edge along its segment with a perpendicular direction", () => {
    const node: CPUParticleNode = still({
      shape: { kind: "edge", length: 20, rotation: 0 },
      startSpeed: 100,
      maxParticles: 64,
    });
    node.emit(64);

    for (let i: number = 0; i < node.aliveCount; i++) {
      expect(Math.abs(node.getX(i))).toBeLessThanOrEqual(10.001);
      expect(node.getY(i)).toBeCloseTo(0, 10);
      expect(node.getVelocityX(i)).toBeCloseTo(0, 4);
      expect(Math.abs(node.getVelocityY(i))).toBeCloseTo(100, 4);
    }
  });
});

describe("CPUParticleNode simulation space", () => {
  it("keeps local offsets untouched in local space", () => {
    const node: CPUParticleNode = still({ simulationSpace: "local" });
    node.setPosition(100, 50);
    node.updateWorldMatrix();
    node.emit(1);

    expect(node.getX(0)).toEqual(0);
    expect(node.getY(0)).toEqual(0);
  });

  it("bakes the world transform at spawn and never drags a live particle", () => {
    const node: CPUParticleNode = still({ simulationSpace: "world" });
    node.setPosition(100, 50);
    node.updateWorldMatrix();
    node.emit(1);

    expect(node.getX(0)).toBeCloseTo(100, 4);
    expect(node.getY(0)).toBeCloseTo(50, 4);

    node.setPosition(999, 999);
    node.updateWorldMatrix();
    node.advance(STEP);

    expect(node.getX(0)).toBeCloseTo(100, 4);
    expect(node.getY(0)).toBeCloseTo(50, 4);
  });

  it("applies the world scale to the sampled offset", () => {
    const node: CPUParticleNode = still({
      simulationSpace: "world",
      shape: { kind: "edge", length: 2, rotation: 0 },
      maxParticles: 32,
    });
    node.setPosition(10, 20);
    node.setScale(2, 3);
    node.updateWorldMatrix();
    node.emit(32);

    for (let i: number = 0; i < node.aliveCount; i++) {
      expect(node.getX(i)).toBeGreaterThanOrEqual(8 - 1e-3);
      expect(node.getX(i)).toBeLessThanOrEqual(12 + 1e-3);
      expect(node.getY(i)).toBeCloseTo(20, 4);
    }
  });
});

describe("CPUParticleNode determinism", () => {
  it("produces identical state for two nodes sharing a seed", () => {
    const config: ParticleEmitterConfig = {
      seed: 1234,
      duration: 1,
      looping: true,
      rate: 20,
      maxParticles: 64,
      shape: { kind: "circle", radius: 50 },
      startSpeed: { min: 10, max: 100 },
      startSize: { min: 1, max: 4 },
      startRotation: { min: 0, max: 6 },
      startLifetime: { min: 0.2, max: 0.6 },
      startColor: { min: new Color(0, 0, 0, 1), max: new Color(1, 1, 1, 1) },
      angularVelocity: { min: -1, max: 1 },
      gravity: { x: 0, y: -200 },
      drag: 0.5,
      bursts: [{ time: 0.25, count: 4, cycles: 2, interval: 0.25 }],
    };

    const a: CPUParticleNode = new CPUParticleNode(config);
    const b: CPUParticleNode = new CPUParticleNode(config);

    a.play();
    b.play();

    for (let i: number = 0; i < 30; i++) {
      a.advance(STEP);
      b.advance(STEP);
    }

    expect(a.aliveCount).toBeGreaterThan(0);
    expect(a.aliveCount).toEqual(b.aliveCount);

    const ca: Vec4 = new Vec4();
    const cb: Vec4 = new Vec4();

    for (let i: number = 0; i < a.aliveCount; i++) {
      expect(a.getX(i)).toEqual(b.getX(i));
      expect(a.getY(i)).toEqual(b.getY(i));
      expect(a.getVelocityX(i)).toEqual(b.getVelocityX(i));
      expect(a.getVelocityY(i)).toEqual(b.getVelocityY(i));
      expect(a.getSize(i)).toEqual(b.getSize(i));
      expect(a.getRotation(i)).toEqual(b.getRotation(i));
      expect(a.getLifeT(i)).toEqual(b.getLifeT(i));

      a.getColor(i, ca);
      b.getColor(i, cb);

      expect(ca.x).toEqual(cb.x);
      expect(ca.y).toEqual(cb.y);
      expect(ca.z).toEqual(cb.z);
      expect(ca.w).toEqual(cb.w);
    }
  });

  it("diverges from an unseeded node", () => {
    const seeded: CPUParticleNode = still({
      seed: 99,
      shape: { kind: "circle", radius: 50 },
      maxParticles: 8,
    });
    const other: CPUParticleNode = still({
      seed: 100,
      shape: { kind: "circle", radius: 50 },
      maxParticles: 8,
    });

    seeded.emit(8);
    other.emit(8);

    let differences: number = 0;

    for (let i: number = 0; i < 8; i++) {
      if (seeded.getX(i) !== other.getX(i)) {
        differences++;
      }
    }

    expect(differences).toBeGreaterThan(0);
  });
});

describe("CPUParticleNode setCapacity", () => {
  it("grows while preserving the live prefix", () => {
    const node: CPUParticleNode = still({ maxParticles: 8 });

    node.startSize = 10;
    node.emit(1);
    node.startSize = 20;
    node.emit(1);
    node.startSize = 30;
    node.emit(1);

    node.setCapacity(16);

    expect(node.capacity).toEqual(16);
    expect(node.aliveCount).toEqual(3);
    expect(node.getSize(0)).toEqual(10);
    expect(node.getSize(1)).toEqual(20);
    expect(node.getSize(2)).toEqual(30);
  });

  it("shrinks while clamping aliveCount to the kept prefix", () => {
    const node: CPUParticleNode = still({ maxParticles: 8 });

    node.startSize = 10;
    node.emit(1);
    node.startSize = 20;
    node.emit(1);
    node.startSize = 30;
    node.emit(1);

    node.setCapacity(2);

    expect(node.capacity).toEqual(2);
    expect(node.aliveCount).toEqual(2);
    expect(node.getSize(0)).toEqual(10);
    expect(node.getSize(1)).toEqual(20);
  });

  it("is a no-op when the size is unchanged", () => {
    const node: CPUParticleNode = still({ maxParticles: 8 });
    node.emit(3);
    node.setCapacity(8);

    expect(node.capacity).toEqual(8);
    expect(node.aliveCount).toEqual(3);
  });
});

describe("CPUParticleNode clamps", () => {
  it("clamps a non-finite constructor capacity to the minimum", () => {
    const node: CPUParticleNode = new CPUParticleNode({ maxParticles: NaN });

    expect(node.capacity).toEqual(1);

    node.emit(5);

    expect(node.aliveCount).toEqual(1);
  });

  it("clamps a non-finite setCapacity to the minimum", () => {
    const node: CPUParticleNode = still({ maxParticles: 8 });
    node.setCapacity(NaN);

    expect(node.capacity).toEqual(1);

    node.setCapacity(Infinity);

    expect(node.capacity).toEqual(1);
  });

  it("clamps a non-positive constructor capacity to the minimum", () => {
    const node: CPUParticleNode = new CPUParticleNode({ maxParticles: -10 });

    expect(node.capacity).toEqual(1);
  });

  it("treats a maxParticles of zero as a closed emitter", () => {
    const node: CPUParticleNode = still({ maxParticles: 0, rate: 100 });
    node.play();
    node.advance(1);
    node.emit(5);

    expect(node.capacity).toEqual(1);
    expect(node.aliveCount).toEqual(0);
  });

  it("clamps a non-finite duration to zero rather than letting it through", () => {
    const node: CPUParticleNode = still({
      rate: 100,
      duration: NaN,
      looping: false,
      maxParticles: 200,
    });
    node.play();
    node.advance(1);

    expect(node.isEmitting).toBe(false);
    expect(node.aliveCount).toEqual(0);
  });

  it("clamps a negative duration to zero", () => {
    const node: CPUParticleNode = still({
      rate: 100,
      duration: -5,
      looping: false,
      maxParticles: 200,
    });
    node.play();
    node.advance(1);

    expect(node.aliveCount).toEqual(0);
  });

  it("clamps a non-finite duration to zero for prewarm too", () => {
    const node: CPUParticleNode = still({
      rate: 100,
      duration: NaN,
      looping: true,
      prewarm: true,
      maxParticles: 200,
    });
    node.play();

    expect(node.aliveCount).toEqual(0);
  });

  it("caps the prewarm step count so a huge duration cannot hang", () => {
    const node: CPUParticleNode = still({
      rate: 1,
      duration: 1e9,
      looping: true,
      prewarm: true,
      maxParticles: 200,
    });
    node.play();

    expect(node.aliveCount).toBeGreaterThanOrEqual(9);
    expect(node.aliveCount).toBeLessThanOrEqual(11);
  });

  it("clamps a non-finite or negative rate to zero", () => {
    const bad: CPUParticleNode = still({ rate: NaN, duration: 100 });
    bad.play();
    bad.advance(1);

    expect(bad.aliveCount).toEqual(0);

    const negative: CPUParticleNode = still({ rate: -10, duration: 100 });
    negative.play();
    negative.advance(1);

    expect(negative.aliveCount).toEqual(0);
  });

  it("clamps a non-finite lifetime so the particle still dies", () => {
    const node: CPUParticleNode = still({ startLifetime: NaN });
    node.emit(1);

    expect(node.aliveCount).toEqual(1);

    node.advance(STEP);

    expect(node.aliveCount).toEqual(0);
  });

  it("clamps a zero lifetime so the particle still dies", () => {
    const node: CPUParticleNode = still({ startLifetime: 0 });
    node.emit(1);
    node.advance(STEP);

    expect(node.aliveCount).toEqual(0);
  });

  it("clamps a non-finite drag to zero", () => {
    const node: CPUParticleNode = still({
      gravity: { x: 0, y: -100 },
      drag: NaN,
    });
    node.emit(1);
    node.advance(0.1);

    expect(node.getVelocityY(0)).toBeCloseTo(-10, 6);
  });

  it("clamps a negative drag to zero", () => {
    const node: CPUParticleNode = still({
      gravity: { x: 0, y: -100 },
      drag: -5,
    });
    node.emit(1);
    node.advance(0.1);

    expect(node.getVelocityY(0)).toBeCloseTo(-10, 6);
  });

  it("clamps a non-finite burst interval so every cycle fires at once", () => {
    const node: CPUParticleNode = still({
      duration: 10,
      bursts: [{ time: 0, count: 1, cycles: 3, interval: NaN }],
    });
    node.play();
    node.advance(0.1);

    expect(node.aliveCount).toEqual(3);
  });

  it("clamps a non-finite or non-positive burst cycles count to one", () => {
    const bad: CPUParticleNode = still({
      duration: 10,
      bursts: [{ time: 0, count: 2, cycles: NaN, interval: 0.1 }],
    });
    bad.play();
    bad.advance(1);

    expect(bad.aliveCount).toEqual(2);

    const zero: CPUParticleNode = still({
      duration: 10,
      bursts: [{ time: 0, count: 2, cycles: 0, interval: 0.1 }],
    });
    zero.play();
    zero.advance(1);

    expect(zero.aliveCount).toEqual(2);
  });

  it("clamps a non-finite burst count to zero", () => {
    const node: CPUParticleNode = still({
      duration: 10,
      bursts: [{ time: 0, count: NaN }],
    });
    node.play();
    node.advance(0.1);

    expect(node.aliveCount).toEqual(0);
  });

  it("clamps a negative burst time to zero", () => {
    const node: CPUParticleNode = still({
      duration: 10,
      bursts: [{ time: -3, count: 2 }],
    });
    node.play();
    node.advance(0.1);

    expect(node.aliveCount).toEqual(2);
  });

  it("clamps a non-finite shape radius to zero", () => {
    const node: CPUParticleNode = still({
      shape: { kind: "circle", radius: NaN },
    });
    node.emit(1);

    expect(node.getX(0)).toBeCloseTo(0, 10);
    expect(node.getY(0)).toBeCloseTo(0, 10);
  });

  it("clamps non-finite box extents to zero", () => {
    const node: CPUParticleNode = still({
      shape: { kind: "box", width: NaN, height: NaN },
    });
    node.emit(1);

    expect(node.getX(0)).toBeCloseTo(0, 10);
    expect(node.getY(0)).toBeCloseTo(0, 10);
  });

  it("ignores a non-positive or non-finite emit count", () => {
    const node: CPUParticleNode = still();
    node.emit(0);
    node.emit(-3);
    node.emit(NaN);

    expect(node.aliveCount).toEqual(0);
  });
});

describe("CPUParticleNode defaults", () => {
  it("exposes the plan's defaults as public mutable fields", () => {
    const node: CPUParticleNode = new CPUParticleNode();

    expect(node.duration).toEqual(1);
    expect(node.looping).toBe(true);
    expect(node.prewarm).toBe(false);
    expect(node.capacity).toEqual(256);
    expect(node.rate).toEqual(10);
    expect(node.drag).toEqual(0);
    expect(node.gravity.x).toEqual(0);
    expect(node.gravity.y).toEqual(0);
    expect(node.sizeOverLifetime).toBeNull();
    expect(node.colorOverLifetime).toBeNull();
    expect(node.velocityOverLifetime).toBeNull();
    expect(node.simulationSpace).toBe("local");
    expect(node.alignment).toBe("fixed");
    expect(node.blend).toBe("alpha");
    expect(node.state).toBe("stopped");
    expect(node.isAlive).toBe(false);
    expect(node.isEmitting).toBe(false);
    expect(node.bursts.length).toEqual(0);
  });

  it("accepts every shape kind through the config", () => {
    const shapes: readonly ParticleShape[] = [
      { kind: "point" },
      { kind: "circle", radius: 4 },
      { kind: "cone", angle: 1, radius: 2 },
      { kind: "box", width: 4, height: 4 },
      { kind: "edge", length: 4 },
    ];

    for (let i: number = 0; i < shapes.length; i++) {
      const node: CPUParticleNode = still({ shape: shapes[i] });
      node.emit(1);

      expect(node.aliveCount).toEqual(1);
      expect(Number.isFinite(node.getX(0))).toBe(true);
      expect(Number.isFinite(node.getY(0))).toBe(true);
    }
  });
});

describe("CPUParticleNode resume", () => {
  it("play after pause resumes the emitter clock instead of restarting it", () => {
    const node: CPUParticleNode = still({
      duration: 10,
      bursts: [{ time: 0, count: 2 }],
    });
    node.play();
    node.advance(0.1);

    expect(node.aliveCount).toEqual(2);

    node.pause();
    node.play();
    node.advance(0.1);

    expect(node.state).toBe("playing");
    expect(node.aliveCount).toEqual(2);
  });

  it("play after stop restarts the emitter clock", () => {
    const node: CPUParticleNode = still({
      duration: 10,
      bursts: [{ time: 0, count: 2 }],
    });
    node.play();
    node.advance(0.1);
    node.stop();
    node.play();
    node.advance(0.1);

    expect(node.aliveCount).toEqual(4);
  });

  it("does not re-run prewarm when resuming from pause", () => {
    const node: CPUParticleNode = new CPUParticleNode({
      rate: 60,
      startSpeed: 0,
      startLifetime: 100,
      duration: 1,
      looping: true,
      prewarm: true,
      maxParticles: 512,
    });
    node.play();

    const warmed: number = node.aliveCount;

    expect(warmed).toBeGreaterThan(0);

    node.pause();
    node.play();

    expect(node.aliveCount).toEqual(warmed);
  });
});

describe("CPUParticleNode maxParticles", () => {
  it("grows the pool when maxParticles is raised after construction", () => {
    const node: CPUParticleNode = still({ maxParticles: 4, rate: 600 });
    node.play();
    node.advance(0.5);

    expect(node.aliveCount).toEqual(4);
    expect(node.capacity).toEqual(4);

    node.maxParticles = 32;

    expect(node.maxParticles).toEqual(32);
    expect(node.capacity).toEqual(32);

    node.advance(0.5);

    expect(node.aliveCount).toEqual(32);
  });

  it("keeps the living particles when maxParticles is raised", () => {
    const node: CPUParticleNode = still({ maxParticles: 4 });
    node.play();
    node.emit(4);
    node.advance(STEP);

    const y: number = node.getY(0);

    node.maxParticles = 16;

    expect(node.aliveCount).toEqual(4);
    expect(node.getY(0)).toBeCloseTo(y, 6);
  });
});
