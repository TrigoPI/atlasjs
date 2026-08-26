import { PI } from "@atlasjs/math";

import {
  AtlasScript,
  registerScriptMetadata,
  ScriptMetadata,
  SpriteRender,
  type GameEntity,
} from "@atlasjs/gameplay";

import { AimScript } from "./AimScript";

type SwordSortingScriptProps = {
  anchor: GameEntity;
  sortingFront: number;
  sortingBehind: number;
};

export class SwordSortingScript extends AtlasScript<SwordSortingScriptProps> {
  private readonly anchor: GameEntity;
  private readonly sortingFront: number;
  private readonly sortingBehind: number;

  private renderer: SpriteRender;

  private aim: AimScript;

  public onCreate(): void {
    this.renderer = this.requireComponent(SpriteRender);

    this.aim = this.requireAnchorAim();
  }

  public onUpdate(): void {
    const angle: number = this.aim.angle;

    if (angle > PI) {
      this.renderer.sortingOrder = this.sortingBehind;
    } else {
      this.renderer.sortingOrder = this.sortingFront;
    }
  }

  private requireAnchorAim(): AimScript {
    const aim: AimScript | undefined = this.anchor.getScript(AimScript);

    if (aim === undefined) {
      throw new Error(
        `[SwordSortingScript] The anchor entity "${this.anchor.id}" carries no AimScript.`,
      );
    }

    return aim;
  }
}

registerScriptMetadata(SwordSortingScript, {
  exposed: {
    anchor: ScriptMetadata.entity({ required: true }),
    sortingFront: ScriptMetadata.field({ required: true }),
    sortingBehind: ScriptMetadata.field({ required: true }),
  },
});
