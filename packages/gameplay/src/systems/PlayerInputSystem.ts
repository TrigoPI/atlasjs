import { ServiceRegistry } from "@atlasjs/core";
import { Entity, NexusSystem, NexusSystemContext } from "@atlasjs/nexus";
import { INPUT, Input } from "@atlasjs/input";

import { PlayerInput } from "../components";

export class PlayerInputSystem implements NexusSystem {
  private readonly services: ServiceRegistry;

  public constructor(services: ServiceRegistry) {
    this.services = services;
  }

  public update({ world, dt }: NexusSystemContext): void {
    let input: Input | undefined;

    world
      .query(PlayerInput)
      .each((_entity: Entity, playerInput: PlayerInput) => {
        if (input === undefined) {
          input = this.services.get(INPUT);
        }

        playerInput.map.update(input, dt);
      });
  }
}
