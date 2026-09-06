import { Scene } from "@atlasjs/core";
import type { SceneContext } from "@atlasjs/core";
import { INSTANTIATOR } from "@atlasjs/gameplay";
import type { GameEntity, Instantiator, Prefab } from "@atlasjs/gameplay";
import type { Vec2 } from "@atlasjs/math";
import type { Entity } from "@atlasjs/nexus";

import { createArenaSimPrefab } from "../game/sim/prefabs/ArenaSimPrefab";
import { createPlayerSimPrefab } from "../game/sim/prefabs/PlayerSimPrefab";
import type { PlayerSimProps } from "../game/sim/prefabs/buildPlayerSim";

export class ServerScene extends Scene {
  private readonly spawns: readonly Vec2[];
  private readonly players: Entity[];

  /* Empty by default: online, players enter through GameRoom.join, and a seed player left in
     the arena would be an invisible obstacle nobody controls. Specs pass their own. */
  public constructor(spawns: readonly Vec2[] = []) {
    super("server-scene");
    this.spawns = spawns;
    this.players = [];
  }

  /* No camera and no asset loading, on purpose. CameraSyncSystem dereferences
     renderer.camera, and the headless renderer is a two-property stub. */
  public override onCreate(ctx: SceneContext): void {
    const instantiator: Instantiator = ctx.services.get(INSTANTIATOR);

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
