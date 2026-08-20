import {
  AtlasScript,
  registerScriptMetadata,
  ScriptMetadata,
} from "@atlasjs/gameplay";

type HurtboxScriptProps = {
  invincibilityDuration?: number;
};

export class HurtboxScript extends AtlasScript<HurtboxScriptProps> {
  private readonly invincibilityDuration: number = 0.4;

  private invincibilityRemaining: number = 0;

  public get isInvincible(): boolean {
    return this.invincibilityRemaining > 0;
  }

  public onUpdate(dt: number): void {
    if (this.invincibilityRemaining <= 0) {
      return;
    }

    this.invincibilityRemaining -= dt;
  }

  public takeHit(invincibilityDuration?: number): boolean {
    if (this.invincibilityRemaining > 0) {
      return false;
    }

    this.invincibilityRemaining =
      invincibilityDuration ?? this.invincibilityDuration;

    return true;
  }
}

registerScriptMetadata(HurtboxScript, {
  exposed: {
    invincibilityDuration: ScriptMetadata.field(),
  },
});
