import type { StepSet } from "@atlasjs/core";
import type { Entity, NexusWorld } from "@atlasjs/nexus";

import { MoveIntent } from "../game/sim/MoveIntent";
import { INPUT_REDUNDANCY } from "../net/protocol";
import type { InputFrame } from "../net/protocol";

import type { NetworkClient } from "./NetworkClient";

export const SEND_INPUT_STEP: string = "bump-royal:send-input";

const COMMIT_INTENTS_STEP: string = "bump-royal:commit-intents";

/* MoveIntent.direction is normalised, so a live axis is never smaller than sin(45°). */
const AXIS_EPSILON: number = 1e-6;

type Axis = -1 | 0 | 1;

function axisOf(value: number): Axis {
  if (value > AXIS_EPSILON) return 1;
  if (value < -AXIS_EPSILON) return -1;

  return 0;
}

class InputSender {
  private readonly world: NexusWorld;
  private readonly entity: Entity;
  private readonly client: NetworkClient;
  private readonly now: () => number;
  private readonly window: InputFrame[];

  private lastTick: number | null;

  public constructor(
    world: NexusWorld,
    entity: Entity,
    client: NetworkClient,
    now: () => number,
  ) {
    this.world = world;
    this.entity = entity;
    this.client = client;
    this.now = now;
    this.window = [];
    this.lastTick = null;
  }

  public step(): void {
    const intent: MoveIntent | undefined = this.world.getComponent(
      this.entity,
      MoveIntent,
    );

    if (intent === undefined) {
      return;
    }

    this.window.push({
      t: this.nextTick(),
      x: axisOf(intent.direction.x),
      y: axisOf(intent.direction.y),
      d: intent.dash,
    });

    while (this.window.length > INPUT_REDUNDANCY) {
      this.window.shift();
    }

    this.client.send({ k: "input", f: [...this.window], a: this.client.ack() });
  }

  /* The client's estimate of the server tick it is producing for. V1 does not schedule on it —
     the inbox consumes one frame per tick in arrival order — but the estimate is what a future
     reconciliation measures its ack against, so it is carried from the start.

     Forced strictly increasing: the inbox drops any frame whose tick is not above its
     watermark, and the fixed lane can run twice inside one millisecond while catching up. Two
     frames sharing an estimate would silently lose one, dash edge included. */
  private nextTick(): number {
    const estimate: number = Math.round(
      this.client.buffer.serverTick(this.now()),
    );
    const last: number | null = this.lastTick;
    const tick: number =
      last === null ? estimate : Math.max(last + 1, estimate);

    this.lastTick = tick;
    return tick;
  }
}

/* Fixed lane, PreSim, after commitIntents: MoveIntent.dash is the edge that step just latched,
   and it is cleared again on the next tick. Reading it anywhere else would either miss the
   press or repeat it. */
export function registerSendInput(
  scheduler: StepSet,
  world: NexusWorld,
  entity: Entity,
  client: NetworkClient,
  now: () => number,
): void {
  const sender: InputSender = new InputSender(world, entity, client, now);

  scheduler.add("fixed", (): void => sender.step(), {
    name: SEND_INPUT_STEP,
    stage: "PreSim",
    after: COMMIT_INTENTS_STEP,
  });
}
