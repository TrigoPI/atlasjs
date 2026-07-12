import { NexusSystem, NexusSystemContext } from "@atlasjs/nexus";
import { createLogger, Logger } from "@atlasjs/utils";

import { RigidBody2DComponent, ScriptComponentStorage } from "../scripting";
import { RigidBody2D } from "../components";

export class RigidBody2DRequestSystem implements NexusSystem {
  private readonly logger: Logger;

  private readonly componentStorage: ScriptComponentStorage;

  public constructor(componentStorage: ScriptComponentStorage) {
    this.logger = createLogger(RigidBody2DRequestSystem.name);
    this.componentStorage = componentStorage;
  }

  public update({ world }: NexusSystemContext): void {
    const entries = this.componentStorage.entries(RigidBody2DComponent);

    for (const [entity, scriptRigidBody] of entries) {
      if (!world.hasComponent(entity, RigidBody2D)) {
        this.logger.log(`Adding RigidBody2D component to entity ${entity}`);
        let body: RigidBody2D = world.addComponent(entity, RigidBody2D);

        body.velocity.x = scriptRigidBody.velocity.x;
        body.velocity.y = scriptRigidBody.velocity.y;

        body.mass = scriptRigidBody.mass;
        body.type = scriptRigidBody.type;
        body.rotation = scriptRigidBody.rotation;
        body.angularVelocity = scriptRigidBody.angularVelocity;
      }
    }
  }
}
