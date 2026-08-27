import { describe, expect, it } from "vitest";

import type { AudioClip } from "@atlasjs/audio";
import type { EntityBuilder } from "@atlasjs/gameplay";

import {
  defaultSwordCombo,
  type SwordComboClips,
} from "../../../../src/game/content/weapons/defaultSwordCombo";

import {
  SpinAttack,
  SwingAttack,
  ThrustAttack,
} from "../../../../src/game/scripts";

type AttachCall = { script: unknown; props: unknown };

class FakeBuilder {
  public readonly attaches: AttachCall[] = [];

  public attach(script: unknown, props?: unknown): unknown {
    this.attaches.push({ script, props });
    return {};
  }
}

function createClips(): SwordComboClips {
  return {
    thrust: {} as unknown as AudioClip,
    swing: {} as unknown as AudioClip,
    spin: {} as unknown as AudioClip,
  };
}

describe("defaultSwordCombo", () => {
  it("gives every link in the chain the hitstop the freeze reads from", () => {
    const builder: FakeBuilder = new FakeBuilder();

    defaultSwordCombo(createClips())(builder as unknown as EntityBuilder);

    const links: unknown[] = [ThrustAttack, SwingAttack, SpinAttack];
    const hitstops: (number | undefined)[] = links.map((script: unknown) => {
      const call: AttachCall | undefined = builder.attaches.find(
        (attached: AttachCall) => attached.script === script,
      );

      return (call?.props as { hitstop?: number } | undefined)?.hitstop;
    });

    expect(hitstops).toEqual([0.08, 0.08, 0.08]);
  });
});
