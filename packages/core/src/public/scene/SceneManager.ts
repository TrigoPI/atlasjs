import { EventBus } from "../engine/EventBus";
import { Scheduler } from "../engine/Scheduler";
import { ServiceRegistry } from "../engine/ServiceRegistry";
import { EngineEvents, StepSet } from "../engine/types";

import { Scene } from "./Scene";
import { SceneContext } from "./SceneContext";

export class SceneManager {
  private readonly services: ServiceRegistry;
  private readonly events: EventBus<EngineEvents>;
  private readonly scheduler: Scheduler;

  private current: Scene | null;
  private currentSet: StepSet | null;
  private isCreating: boolean;

  public constructor(
    services: ServiceRegistry,
    events: EventBus<EngineEvents>,
    scheduler: Scheduler,
  ) {
    this.services = services;
    this.events = events;
    this.scheduler = scheduler;

    this.current = null;
    this.currentSet = null;
    this.isCreating = false;
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
    this.currentSet?.remove();
    this.current = null;
    this.currentSet = null;
  }

  private async createNewScene(scene: Scene): Promise<void> {
    const set: StepSet = this.scheduler.createSet(`scene:${scene.name}`);
    const ctx: SceneContext = {
      services: this.services,
      events: this.events,
      scheduler: set,
    };

    try {
      await scene.onCreate(ctx);
      this.current = scene;
      this.currentSet = set;
    } catch (error) {
      set.remove();
      throw error;
    } finally {
      this.isCreating = false;
    }
  }
}
