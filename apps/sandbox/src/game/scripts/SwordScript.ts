import { Vec2 } from "@atlasjs/math";

import {
  Sprite,
  AtlasScript,
  registerScriptMetadata,
  SpriteRenderer,
  Transform,
  InputApi,
  Key,
  CameraApi,
} from "@atlasjs/gameplay";

type MinMax = {
  min: number;
  max: number;
};

type SwordState = "orbit" | "thrown";

const CHARGE_RATE: number = 1.5;
const DISCHARGE_RATE: number = 3;
const THROW_THRESHOLD: number = 0.05;

export class SwordScript extends AtlasScript<{
  scale: number;
  sprite: Sprite;
  maxPower: number;
  rotationSpeed: MinMax;
  orbitRadius: number;
  orbitSpeed: MinMax;
  throwDuration: number;
}> {
  private readonly sprite: Sprite;
  private readonly rotationSpeed: MinMax;
  private readonly orbitSpeed: MinMax;

  private readonly scale: number;
  private readonly maxPower: number;
  private readonly orbitRadius: number;
  private readonly throwDuration: number;

  private transform: Transform;
  private spriteRenderer: SpriteRenderer;

  private input: InputApi;
  private camera: CameraApi;

  private savedParent: Transform | null;

  private state: SwordState;
  private charge: number;
  private orbitAngle: number;
  private spin: number;

  private throwTime: number;
  private throwDir: Vec2;
  private startWorld: Vec2;

  public onCreate(): void {
    this.input = this.getService(InputApi);
    this.camera = this.getService(CameraApi);

    this.transform = this.addComponent(Transform);
    this.spriteRenderer = this.addComponent(SpriteRenderer, this.sprite);

    this.transform.setScale(this.scale, this.scale);
    this.spriteRenderer.sortingOrder = 10;

    this.savedParent = this.transform.parent;

    this.state = "orbit";
    this.charge = 0;
    this.orbitAngle = 0;
    this.spin = 0;

    this.throwTime = 0;
    this.throwDir = new Vec2();
    this.startWorld = new Vec2();
  }

  public onUpdate(dt: number): void {
    if (this.state === "orbit") {
      this.tickOrbit(dt);
    } else {
      this.tickThrown(dt);
    }
  }

  private tickOrbit(dt: number): void {
    if (this.input.isDown(Key.MouseLeft)) {
      this.charge = Math.min(1, this.charge + CHARGE_RATE * dt);
    } else {
      this.charge = Math.max(0, this.charge - DISCHARGE_RATE * dt);
    }

    const orbitVelocity: number = this.lerp(
      this.orbitSpeed.min,
      this.orbitSpeed.max,
      this.charge,
    );

    const spinVelocity: number = this.lerp(
      this.rotationSpeed.min,
      this.rotationSpeed.max,
      this.charge,
    );

    this.orbitAngle += orbitVelocity * dt;
    this.spin += spinVelocity * dt;

    const x: number = Math.cos(this.orbitAngle) * this.orbitRadius;
    const y: number = Math.sin(this.orbitAngle) * this.orbitRadius;

    this.transform.setPosition(x, y);
    this.transform.setRotation(this.spin);

    if (this.input.isReleased(Key.MouseLeft) && this.charge > THROW_THRESHOLD) {
      this.beginThrow();
    }
  }

  // prettier-ignore
  private beginThrow(): void {
    if (this.savedParent === null) {
      return;
    }

    const parentWorld: Vec2 = this.savedParent.worldPosition;
    const x: number = parentWorld.x + Math.cos(this.orbitAngle) * this.orbitRadius;
    const y: number = parentWorld.y + Math.sin(this.orbitAngle) * this.orbitRadius;

    this.startWorld.set(x, y);

    this.transform.setParent(null, false);
    this.transform.setPosition(this.startWorld.x, this.startWorld.y);

    const mouseWorld: Vec2 = this.camera.screenToWorld(this.input.mousePosition);

    this.throwDir.copyFrom(mouseWorld).sub(this.startWorld).normalize();

    this.throwTime = 0;
    this.state = "thrown";
  }

  // prettier-ignore
  private tickThrown(dt: number): void {
    const parent: Transform | null = this.savedParent;

    this.throwTime += dt;

    const t: number = Math.min(this.throwTime / this.throwDuration, 1);
    const amplitude: number = this.charge * this.maxPower * Math.sin(Math.PI * t);

    const parentWorld: Vec2 = parent !== null ? parent.worldPosition : this.startWorld;
    const homeX: number = parentWorld.x + Math.cos(this.orbitAngle) * this.orbitRadius;
    const homeY: number = parentWorld.y + Math.sin(this.orbitAngle) * this.orbitRadius;

    const x: number = this.lerp(this.startWorld.x, homeX, t) + this.throwDir.x * amplitude;
    const y: number = this.lerp(this.startWorld.y, homeY, t) + this.throwDir.y * amplitude;

    this.transform.setPosition(x, y);

    this.spin += this.rotationSpeed.max * dt;
    this.transform.setRotation(this.spin);

    if (t >= 1) {
      this.endThrow();
    }
  }

  private endThrow(): void {
    this.transform.setParent(this.savedParent, false);
    this.transform.setPosition(
      Math.cos(this.orbitAngle) * this.orbitRadius,
      Math.sin(this.orbitAngle) * this.orbitRadius,
    );

    this.state = "orbit";
    this.charge = 0;
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}

registerScriptMetadata(SwordScript, {
  exposed: {
    sprite: { required: true },
    scale: { required: true },
    maxPower: { required: true },
    rotationSpeed: { required: true },
    orbitRadius: { required: true },
    orbitSpeed: { required: true },
    throwDuration: { required: true },
  },
});
