import { Vec2 } from "@atlasjs/math";
import type { AudioClip } from "@atlasjs/audio";

import {
  AtlasScript,
  AudioApi,
  CameraApi,
  InputApi,
  Key,
  registerScriptMetadata,
  ScriptMetadata,
  Transform,
  type GameEntity,
} from "@atlasjs/gameplay";

import { HurtboxScript } from "../combat/HurtboxScript";

import { readAimAngle } from "./aim";
import type { AttackPose, WeaponAttack } from "./attacks/WeaponAttack";
import type { SwordHitboxScript } from "./SwordHitboxScript";

type SwordScriptProps = {
  playerAnchor: GameEntity;
  radius: number;
  angleOffset: number;
  attack: WeaponAttack;
  hitbox: SwordHitboxScript;
  hitstopDuration?: number;
  targetInvincibility?: number;
  hitClip?: AudioClip;
  hitPitch?: number;
  hitVolume?: number;
};

type SwordState = "idle" | "attacking";

export class SwordScript extends AtlasScript<SwordScriptProps> {
  private readonly playerAnchor: GameEntity;
  private readonly radius: number;
  private readonly angleOffset: number;
  private readonly attack: WeaponAttack;
  private readonly hitbox: SwordHitboxScript;
  private readonly hitstopDuration: number = 0.07;
  private readonly targetInvincibility?: number;
  private readonly hitClip?: AudioClip;
  private readonly hitPitch: number = 1;
  private readonly hitVolume: number = 1;

  private transform: Transform;
  private offsetAmplitude: number;
  private offsetFrequency: number;
  private clock: number;

  private baseScale: Vec2;
  private attackClock: number;
  private swingDirection: number;
  private attackDuration: number;
  private frozenAimAngle: number;

  private readonly pose: AttackPose = {
    angleOffset: 0,
    radiusScale: 1,
    scale: 1,
  };

  private input: InputApi;
  private camera: CameraApi;
  private audio?: AudioApi;

  private state: SwordState;
  private buffered: boolean;
  private hitstopRemaining: number;

  public onCreate(): void {
    this.transform = this.requireComponent(Transform);

    this.input = this.getService(InputApi);
    this.camera = this.getService(CameraApi);
    this.audio = this.getService(AudioApi);

    this.clock = 0;
    this.offsetAmplitude = 8;
    this.offsetFrequency = 0.7;

    this.baseScale = this.transform.scale.clone();
    this.attackClock = 0;
    this.swingDirection = 1;
    this.attackDuration = 0;
    this.frozenAimAngle = 0;

    this.state = "idle";
    this.buffered = false;
    this.hitstopRemaining = 0;
  }

  public onUpdate(dt: number): void {
    this.clock += dt;

    const clicked: boolean = this.input.isPressed(Key.MouseLeft);

    if (clicked && this.state === "attacking") {
      this.buffered = true;
    }

    if (this.state === "idle" && (clicked || this.buffered)) {
      this.buffered = false;
      this.startAttack();
    }

    if (this.state === "attacking") {
      this.updateAttackingState(dt);
      return;
    }

    this.updateIdleState();
  }

  private updateIdleState(): void {
    const playerAnchorWorld: Vec2 = this.getWorldPosition(this.playerAnchor);
    const aimAngle: number = this.getAimAngle();
    const orbitOffset: Vec2 = Vec2.fromAngle(aimAngle).mult(this.radius);
    const offset: Vec2 = this.getFloatingOffset();

    this.transform.position
      .copyFrom(playerAnchorWorld)
      .add(orbitOffset)
      .add(offset);
    this.transform.rotation = this.getSwordRotation();
  }

  // prettier-ignore
  private updateAttackingState(dt: number): void {
    if (this.hitstopRemaining > 0) {
      this.hitstopRemaining -= dt;
      this.applyAttackPose(this.frozenAimAngle);
      return;
    }

    this.attackClock += dt;
    this.attack.sample(this.attackClock, this.pose);

    if (this.applyHits()) {
      this.hitstopRemaining = this.hitstopDuration;
      this.frozenAimAngle = this.getAimAngle();
      this.playImpactSound();
    }

    this.applyAttackPose(this.getAimAngle());

    if (this.attackClock >= this.attackDuration) {
      this.state = "idle";
    }
  }

  // prettier-ignore
  private applyAttackPose(aimAngle: number): void {
    const playerAnchorWorld: Vec2 = this.getWorldPosition(this.playerAnchor);

    const angle: number = aimAngle + this.pose.angleOffset * this.swingDirection;

    const offset: Vec2 = Vec2.fromAngle(angle).mult(this.radius * this.pose.radiusScale);

    this.transform.position.copyFrom(playerAnchorWorld).add(offset);
    this.transform.rotation = angle + Math.PI / 4;
    this.transform.setScale(this.baseScale.x * this.pose.scale, this.baseScale.y * this.pose.scale);
  }

  private startAttack(): void {
    this.state = "attacking";
    this.attackClock = 0;
    this.swingDirection = Math.cos(this.getAimAngle()) >= 0 ? -1 : 1;
    this.hitstopRemaining = 0;
    this.pose.angleOffset = 0;
    this.pose.radiusScale = 1;
    this.pose.scale = 1;
    this.attack.begin();
    this.attackDuration = this.attack.duration;
  }

  private applyHits(): boolean {
    const targets: readonly GameEntity[] = this.hitbox.getTargets();
    let landed: boolean = false;

    for (const target of targets) {
      const hurtbox: HurtboxScript | undefined =
        target.getScript(HurtboxScript);

      if (hurtbox === undefined) {
        continue;
      }

      if (hurtbox.takeHit(this.targetInvincibility)) {
        landed = true;
      }
    }

    return landed;
  }

  private getFloatingOffset(): Vec2 {
    const w: number = 2 * Math.PI * this.offsetFrequency;
    const offset: number = Math.sin(w * this.clock) * this.offsetAmplitude;
    return new Vec2(0, offset);
  }

  private getSwordRotation(): number {
    const swordWorldPos: Vec2 = this.transform.worldPosition;
    return readAimAngle(this.input, this.camera, swordWorldPos) + Math.PI / 4;
  }

  private getAimAngle(): number {
    const playerAnchorWorld: Vec2 = this.getWorldPosition(this.playerAnchor);
    return (
      readAimAngle(this.input, this.camera, playerAnchorWorld) +
      this.angleOffset
    );
  }

  private getWorldPosition(entity: GameEntity): Vec2 {
    return entity.requireComponent(Transform).worldPosition;
  }

  private playImpactSound(): void {
    if (this.audio === undefined || this.hitClip === undefined) {
      return;
    }

    this.audio.playOneShot(this.hitClip, {
      pitch: this.hitPitch,
      volume: this.hitVolume,
    });
  }
}

registerScriptMetadata(SwordScript, {
  exposed: {
    playerAnchor: ScriptMetadata.entity({ required: true }),
    radius: ScriptMetadata.field({ required: true }),
    angleOffset: ScriptMetadata.field({ required: true }),
    attack: ScriptMetadata.field({ required: true }),
    hitbox: ScriptMetadata.field({ required: true }),
    hitstopDuration: ScriptMetadata.field(),
    targetInvincibility: ScriptMetadata.field(),
    hitClip: ScriptMetadata.field(),
    hitPitch: ScriptMetadata.field(),
    hitVolume: ScriptMetadata.field(),
  },
});
