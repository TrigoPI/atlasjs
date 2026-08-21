import type { AudioClip } from "@atlasjs/audio";
import type { EntityBuilder } from "@atlasjs/gameplay";

import {
  AttackChain,
  LungeAttack,
  ThrustAttack,
  ThrustChainAttack,
  type WeaponAttack,
  type WeaponAttackFactory,
} from "../../scripts";

export type RappierComboClips = {
  thrust: AudioClip;
  swing: AudioClip;
  lunge: AudioClip;
};

const THRUST_PITCH: number = 2.5;

// prettier-ignore
export function rappierSwordCombo(clips: RappierComboClips): WeaponAttackFactory {
  return (entity: EntityBuilder): WeaponAttack =>
    entity.attach(AttackChain, {
      attacks: [
        entity.attach(ThrustAttack, {
          clip: clips.thrust,
          pitch: THRUST_PITCH,
          thrustRadius: 2.6,
          thrustDuration: 0.05,
          holdDuration: 0.04,
          recoverDuration: 0.14,
        }),
        entity.attach(ThrustChainAttack, {
          clip: clips.swing,
          pitch: THRUST_PITCH,
          pitchStep: 0.12,
          thrustCount: 3,
          thrustRadius: 2.4,
          radiusStep: 0.25,
          thrustDuration: 0.05,
          holdDuration: 0.05,
          recoverDuration: 0.16,
        }),
        entity.attach(LungeAttack, {
          clip: clips.lunge,
          pitch: 1.6,
          knockback: 2200,
          hitstop: 0.12,
          lungeRadius: 3.6,
        }),
      ],
    });
}
