import { describe, expect, it } from "vitest";

import { Vec2 } from "@atlasjs/math";

import { SwordSortingScript } from "../../../../src/game/scripts/weapon/SwordSortingScript";

const FRONT: number = 40;
const BEHIND: number = 10;

type Rig = {
  sorting: SwordSortingScript;
  renderer: { sortingOrder: number };
  aimAt: (direction: Vec2) => void;
  order: () => number;
};

function createRig(): Rig {
  const sorting: SwordSortingScript = new SwordSortingScript();
  const renderer: { sortingOrder: number } = { sortingOrder: 0 };
  const aim: { angle: number } = { angle: 0 };

  const injected: Record<string, unknown> = sorting as unknown as Record<
    string,
    unknown
  >;

  injected.renderer = renderer;
  injected.aim = aim;
  injected.sortingFront = FRONT;
  injected.sortingBehind = BEHIND;

  return {
    sorting,
    renderer,
    aimAt: (direction: Vec2): void => {
      aim.angle = direction.angle();
      sorting.onUpdate();
    },
    order: (): number => renderer.sortingOrder,
  };
}

describe("SwordSortingScript", () => {
  it("draws the sword behind the player when the aim points up the screen, which is -Y in this Y-down world", () => {
    const rig: Rig = createRig();

    rig.aimAt(new Vec2(0, -1));

    expect(rig.order()).toBe(BEHIND);
  });

  it("draws the sword in front of the player when the aim points down the screen, which is +Y", () => {
    const rig: Rig = createRig();

    rig.aimAt(new Vec2(0, 1));

    expect(rig.order()).toBe(FRONT);
  });

  it("reads a normalized aim angle, so pointing up means an angle beyond PI rather than a negative one", () => {
    const rig: Rig = createRig();

    const up: number = new Vec2(0, -1).angle();

    expect(up).toBeGreaterThan(Math.PI);
    expect(up).toBeLessThan(Math.PI * 2);

    rig.aimAt(new Vec2(0, -1));

    expect(rig.order()).toBe(BEHIND);
  });

  it("keeps the sword in front on the horizontal aims, which sit on the 0 and PI boundaries", () => {
    const rig: Rig = createRig();

    rig.aimAt(new Vec2(1, 0));
    expect(rig.order()).toBe(FRONT);

    rig.aimAt(new Vec2(-1, 0));
    expect(rig.order()).toBe(FRONT);
  });

  it("follows the aim back and forth rather than latching on the first decision", () => {
    const rig: Rig = createRig();

    rig.aimAt(new Vec2(1, 1));
    expect(rig.order()).toBe(FRONT);

    rig.aimAt(new Vec2(1, -1));
    expect(rig.order()).toBe(BEHIND);

    rig.aimAt(new Vec2(-1, 1));
    expect(rig.order()).toBe(FRONT);

    rig.aimAt(new Vec2(-1, -1));
    expect(rig.order()).toBe(BEHIND);
  });

  it("sorts every direction of a full turn by the sign of its Y, not by the sign of its angle", () => {
    const rig: Rig = createRig();

    for (let i: number = 1; i < 360; i++) {
      const r: number = (i * Math.PI) / 180;
      const direction: Vec2 = Vec2.fromAngle(r);

      rig.aimAt(direction);

      const expected: number = direction.y < 0 ? BEHIND : FRONT;

      expect(rig.order()).toBe(expected);
    }
  });
});
