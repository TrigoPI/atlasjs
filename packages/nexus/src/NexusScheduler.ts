import { NexusSystemContext, SystemPhase } from "./nexus-types";
import { NexusSystem } from "./NexusSystem";
import { NexusWorld } from "./NexusWorld";

export class SystemScheduler {
  private readonly systemsByPhase: Map<SystemPhase, NexusSystem[]>;
  private readonly world: NexusWorld;

  public constructor(world: NexusWorld) {
    this.world = world;
    this.systemsByPhase = new Map([
      ["startup", []],
      ["fixedUpdate", []],
      ["update", []],
      ["lateUpdate", []],
    ]);
  }

  public add(phase: SystemPhase, system: NexusSystem): SystemScheduler {
    this.systemsByPhase.get(phase)!.push(system);
    return this;
  }

  public runPhase(phase: SystemPhase, dt: number): void {
    const systems: NexusSystem[] = this.systemsByPhase.get(phase)!;
    const context: NexusSystemContext = {
      dt,
      world: this.world,
    };

    for (const system of systems) {
      system.update(context);
    }
  }
}
