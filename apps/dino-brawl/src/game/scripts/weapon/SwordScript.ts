import { Vec2 } from "@atlasjs/math";

import { readAimAngle } from "./aim";
import { AimScript } from "./AimScript";
import { MeleeHitResolver } from "../combat/MeleeHitResolver";
import { SWORD_IMPACT_SHAKE } from "../../config";
import type { AttackPose, WeaponAttack } from "./attacks/WeaponAttack";
import type { SwordHitboxScript } from "./SwordHitboxScript";

import {
  type GameEntity,
  type ShakeSpec,
  AtlasScript,
  CameraApi,
  InputApi,
  Key,
  registerScriptMetadata,
  ScriptMetadata,
  Transform,
} from "@atlasjs/gameplay";

type SwordScriptProps = {
  playerAnchor: GameEntity;
  radius: number;
  angleOffset: number;
  attack: WeaponAttack;
  hitbox: SwordHitboxScript;
  hitstopDuration?: number;
  knockback?: number;
  shake?: ShakeSpec;
};

type SwordState = "idle" | "attacking";

export class SwordScript extends AtlasScript<SwordScriptProps> {
  private readonly playerAnchor: GameEntity;
  private readonly radius: number;
  private readonly angleOffset: number;
  private readonly attack: WeaponAttack;
  private readonly hitbox: SwordHitboxScript;
  private readonly hitstopDuration: number = 0;
  private readonly knockback: number = 220;
  private readonly shake: ShakeSpec = SWORD_IMPACT_SHAKE;

  private readonly blowDirection: Vec2 = new Vec2();
  private readonly orbitOffset: Vec2 = new Vec2();

  private resolver: MeleeHitResolver | undefined;

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
  private aim: AimScript;

  private state: SwordState;
  private buffered: boolean;
  private hitstopRemaining: number;

  public onCreate(): void {
    this.transform = this.requireComponent(Transform);

    this.input = this.getService(InputApi);
    this.camera = this.getService(CameraApi);
    this.aim = this.requireAnchorAim();

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
    } else {
      this.updateIdleState();
    }
  }

  private updateIdleState(): void {
    const playerAnchorWorld: Vec2 = this.getWorldPosition(this.playerAnchor);
    const aimAngle: number = this.getAimAngle();

    this.setOrbitOffset(aimAngle, this.radius);
    this.orbitOffset.y += this.getFloatingOffset();

    this.transform.position.copyFrom(playerAnchorWorld).add(this.orbitOffset);
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
    this.attack.advance(this.attackClock);

    if (this.attack.rearmsHits) {
      this.armResolver();
    }

    this.attack.sample(this.attackClock, this.pose);

    const aimAngle: number = this.getAimAngle();

    this.blowDirection.set(Math.cos(aimAngle), Math.sin(aimAngle));

    if (this.getResolver().resolve(this.blowDirection)) {
      this.hitstopRemaining = this.attack.impactHitstop ?? this.hitstopDuration;
      this.frozenAimAngle = aimAngle;
      this.camera.shake(this.shake, this.blowDirection);
    }

    this.applyAttackPose(aimAngle);

    if (this.attackClock >= this.attackDuration) {
      this.state = "idle";
    }
  }

  // prettier-ignore
  private applyAttackPose(aimAngle: number): void {
    const playerAnchorWorld: Vec2 = this.getWorldPosition(this.playerAnchor);

    const angle: number = aimAngle + this.pose.angleOffset * this.swingDirection;

    this.setOrbitOffset(angle, this.radius * this.pose.radiusScale);

    this.transform.position.copyFrom(playerAnchorWorld).add(this.orbitOffset);
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
    this.armResolver();
  }

  private armResolver(): void {
    this.getResolver().beginSwing(
      this.attack.impactKnockback,
      this.attack.impactHitstop,
    );
  }

  private getResolver(): MeleeHitResolver {
    if (this.resolver === undefined) {
      this.resolver = new MeleeHitResolver(
        this.hitbox,
        this.knockback,
        this.hitstopDuration,
      );
    }

    return this.resolver;
  }

  private setOrbitOffset(angle: number, radius: number): void {
    this.orbitOffset.set(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }

  private getFloatingOffset(): number {
    const w: number = 2 * Math.PI * this.offsetFrequency;
    return Math.sin(w * this.clock) * this.offsetAmplitude;
  }

  private getSwordRotation(): number {
    const swordWorldPos: Vec2 = this.transform.worldPosition;
    return readAimAngle(this.input, this.camera, swordWorldPos) + Math.PI / 4;
  }

  private getAimAngle(): number {
    return this.aim.angle + this.angleOffset;
  }

  private requireAnchorAim(): AimScript {
    const aim: AimScript | undefined = this.playerAnchor.getScript(AimScript);

    if (aim === undefined) {
      throw new Error(
        `[SwordScript] The player anchor entity "${this.playerAnchor.id}" carries no AimScript.`,
      );
    }

    return aim;
  }

  private getWorldPosition(entity: GameEntity): Vec2 {
    return entity.requireComponent(Transform).worldPosition;
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
    knockback: ScriptMetadata.field(),
    shake: ScriptMetadata.field(),
  },
});
