import type { AudioClip } from "@atlasjs/audio";
import type { EntityBuilder } from "@atlasjs/gameplay";

import {
  AttackChain,
  SpinAttack,
  SwingAttack,
  ThrustAttack,
  type WeaponAttack,
  type WeaponAttackFactory,
} from "../../scripts";

export type SwordComboClips = {
  thrust: AudioClip;
  swing: AudioClip;
  spin: AudioClip;
};

const THRUST_PITCH: number = 1;
const SWING_PITCH: number = 1.1;
const SPIN_PITCH: number = 1.2;

// prettier-ignore
export function defaultSwordCombo(clips: SwordComboClips): WeaponAttackFactory {
  return (entity: EntityBuilder): WeaponAttack =>
    entity.attach(AttackChain, {
      attacks: [
        entity.attach(ThrustAttack, { clip: clips.thrust, pitch: THRUST_PITCH }),
        entity.attach(SwingAttack, { clip: clips.swing, pitch: SWING_PITCH }),
        entity.attach(SpinAttack, { clip: clips.spin, pitch: SPIN_PITCH }),
      ],
    });
}
