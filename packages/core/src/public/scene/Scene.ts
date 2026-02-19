import { SceneContext } from "./SceneContext";

export abstract class Scene {
  public readonly name: string;

  protected constructor(name?: string) {
    this.name = name ?? this.constructor.name;
  }

  public onCreate(ctx: SceneContext): void | Promise<void> {}
  public onUpdate(dt: number): void {}
  public onDestroy(): void {}
}
