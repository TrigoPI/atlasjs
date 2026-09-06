import type { StepContext, StepSet } from "@atlasjs/core";
import type { ButtonAction, Vector2Action } from "@atlasjs/input";
import type {
  Entity,
  NexusSystem,
  NexusSystemContext,
  NexusWorld,
  Query,
} from "@atlasjs/nexus";

import { PlayerInput } from "@atlasjs/gameplay";

import type { PlayerControlsType } from "../controls";
import { MoveIntent } from "./MoveIntent";

const LOCAL_INTENT_STEP: string = "bump-royal:local-intent";
const COMMIT_INTENTS_STEP: string = "bump-royal:commit-intents";
const PLAYER_INPUT_STEP: string = "gameplay:player-input";

export class LocalIntentSampler implements NexusSystem {
  public update({ world }: NexusSystemContext): void {
    const players: Query<[PlayerInput<PlayerControlsType>, MoveIntent]> =
      world.query(PlayerInput, MoveIntent);

    players.each(
      (
        _entity: Entity,
        input: PlayerInput<PlayerControlsType>,
        intent: MoveIntent,
      ): void => {
        const move: Vector2Action = input.get("move");
        const dash: ButtonAction = input.get("dash");

        intent.direction.copyFrom(move.readValue()).normalize();

        if (dash.isPressed()) {
          intent.dashLatched = true;
        }
      },
    );
  }
}

export function commitIntents(world: NexusWorld, tick: number): void {
  const intents: Query<[MoveIntent]> = world.query(MoveIntent);

  intents.each((_entity: Entity, intent: MoveIntent): void => {
    intent.dash = intent.dashLatched;
    intent.dashLatched = false;
    intent.tick = tick;
  });
}

export function registerLocalIntent(
  scheduler: StepSet,
  world: NexusWorld,
): void {
  const sampler: LocalIntentSampler = new LocalIntentSampler();

  scheduler.add(
    "update",
    (ctx: StepContext): void => sampler.update({ world, dt: ctx.dt }),
    {
      name: LOCAL_INTENT_STEP,
      stage: "Early",
      after: PLAYER_INPUT_STEP,
    },
  );

  scheduler.add(
    "fixed",
    (ctx: StepContext): void => commitIntents(world, ctx.tick),
    {
      name: COMMIT_INTENTS_STEP,
      stage: "PreSim",
    },
  );
}
