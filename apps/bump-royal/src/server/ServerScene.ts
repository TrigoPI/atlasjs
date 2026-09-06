import { Scene } from "@atlasjs/core";
import type { SceneContext } from "@atlasjs/core";
import { INSTANTIATOR } from "@atlasjs/gameplay";
import type { GameEntity, Instantiator, Prefab } from "@atlasjs/gameplay";
import { Vec2 } from "@atlasjs/math";
import { NEXUS } from "@atlasjs/nexus";
import type { Entity, NexusWorld } from "@atlasjs/nexus";

import { createArenaSimPrefab } from "../game/sim/prefabs/ArenaSimPrefab";
import { createPlayerSimPrefab } from "../game/sim/prefabs/PlayerSimPrefab";
import type { PlayerSimProps } from "../game/sim/prefabs/buildPlayerSim";

import { registerBotIntentDriver } from "./botIntentDriver";

export const SPAWN_POSITIONS: readonly Vec2[] = [
  Vec2.create(0, 0),
  Vec2.create(0, 100),
];

const BOT_DIRECTION: Vec2 = Vec2.create(1, 0);

export class ServerScene extends Scene {
  private readonly spawns: readonly Vec2[];
  private readonly botDirection: Vec2;
  private readonly players: Entity[];

  public constructor(
    spawns: readonly Vec2[] = SPAWN_POSITIONS,
    botDirection: Vec2 = BOT_DIRECTION,
  ) {
    super("server-scene");
    this.spawns = spawns;
    this.botDirection = botDirection;
    this.players = [];
  }

  /* No camera and no asset loading, on purpose. CameraSyncSystem dereferences
     renderer.camera, and the headless renderer is a two-property stub. */
  public override onCreate(ctx: SceneContext): void {
    const world: NexusWorld = ctx.services.get(NEXUS);
    const instantiator: Instantiator = ctx.services.get(INSTANTIATOR);

    registerBotIntentDriver(ctx.scheduler, world, {
      direction: this.botDirection,
    });

    instantiator.instantiate(createArenaSimPrefab());

    const playerPrefab: Prefab<PlayerSimProps> = createPlayerSimPrefab();

    for (const spawn of this.spawns) {
      const player: GameEntity = instantiator.instantiate(playerPrefab, {
        position: spawn,
      });

      this.players.push(player.id);
    }
  }

  public override onDestroy(): void {
    this.players.length = 0;
  }

  public getPlayers(): readonly Entity[] {
    return this.players;
  }
}
