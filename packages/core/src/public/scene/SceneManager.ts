import { Scene } from "./Scene";
import { SceneContext } from "./SceneContext";

export class SceneManager {
  private readonly ctx: SceneContext;

  private current: Scene | null;
  private isCreating: boolean;

  public constructor(ctx: SceneContext) {
    this.current = null;
    this.isCreating = false;
    this.ctx = ctx;
  }

  public get active(): Scene | null {
    return this.current;
  }

  public async set(scene: Scene): Promise<void> {
    if (this.isCreating) {
      throw new Error(
        "SceneManager: cannot set a scene while another scene is creating",
      );
    }

    this.isCreating = true;
    this.destroy();
    await this.createNewScene(scene);
  }

  public update(dt: number): void {
    if (!this.current) return;
    this.current.onUpdate(dt);
  }

  public destroy(): void {
    if (!this.current) return;
    this.current.onDestroy();
    this.current = null;
  }

  private async createNewScene(scene: Scene): Promise<void> {
    try {
      await scene.onCreate(this.ctx);
      this.current = scene;
    } finally {
      this.isCreating = false;
    }
  }
}
