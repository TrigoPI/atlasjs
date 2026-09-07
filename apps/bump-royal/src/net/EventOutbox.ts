import { MAX_EVENTS_PER_SNAPSHOT } from "./protocol";
import type { ServerEvent } from "./protocol";

const EMPTY_EVENTS: readonly ServerEvent[] = [];

/* The seam a simulation script writes discrete events through. `tick` is carried by the sink
   rather than passed in because neither onCollisionEnter nor onFixedUpdate receives one, and a
   script that guessed would timestamp events the client then plays at the wrong moment. */
export interface EventOutbox {
  readonly tick: number;
  push(event: ServerEvent): void;
}

/* Offline nothing drains anything, and buildPlayerSim must stay ignorant of which mode it is
   building for: the reporters always have a sink, and this one throws the events away. */
export const NULL_EVENT_OUTBOX: EventOutbox = {
  tick: 0,
  push: (): void => {},
};

export class ServerEventOutbox implements EventOutbox {
  private readonly events: ServerEvent[];

  private currentTick: number;

  public constructor() {
    this.events = [];
    this.currentTick = 0;
  }

  public get tick(): number {
    return this.currentTick;
  }

  public get size(): number {
    return this.events.length;
  }

  public stamp(tick: number): void {
    this.currentTick = tick;
  }

  /* Over the cap the oldest event is dropped rather than the newest kept out: the codec refuses
     a whole snapshot whose `e` array is longer than MAX_EVENTS_PER_SNAPSHOT, so overflowing here
     would freeze every client instead of costing one squish. The protocol's own arithmetic says
     132 is the ceiling at MAX_PLAYERS, so this is a guard, not a working limit. */
  public push(event: ServerEvent): void {
    this.events.push(event);

    if (this.events.length > MAX_EVENTS_PER_SNAPSHOT) {
      this.events.shift();
    }
  }

  /* Already in tick order: the stamp is advanced once per fixed tick at PreSim and the fixed
     lane runs its ticks in order, so push order is tick order. */
  public drain(): readonly ServerEvent[] {
    if (this.events.length === 0) {
      return EMPTY_EVENTS;
    }

    const drained: ServerEvent[] = this.events.slice();
    this.events.length = 0;
    return drained;
  }

  public clear(): void {
    this.events.length = 0;
  }
}
