import {
  AtlasScript,
  registerScriptMetadata,
  RigidBody,
  ScriptMetadata,
  Tag,
  Transform2D,
  type Collision,
  type GameEntity,
} from "@atlasjs/gameplay";

import { impactSpeedBetween, reportsPair } from "../../impact";
import { NetPlayer } from "../../NetPlayer";

import type { EventOutbox } from "../../../../net/EventOutbox";

type PlayerBumpReportScriptProps = {
  outbox: EventOutbox;
};

/* Simulation side: no audio, no particles, no service lookup. The moment of a bump is what the
   client cannot derive — a dash contact opens and closes inside a single snapshot interval — so
   the server reports it instead. */
export class PlayerBumpReportScript extends AtlasScript<PlayerBumpReportScriptProps> {
  private readonly outbox: EventOutbox;

  private transform: Transform2D;
  private rigidBody: RigidBody | undefined;
  private net: NetPlayer | undefined;

  public onCreate(): void {
    this.transform = this.requireComponent(Transform2D);
    this.rigidBody = this.getComponent(RigidBody);
    this.net = this.getComponent(NetPlayer);
  }

  // prettier-ignore
  public onCollisionEnter(other: GameEntity, collision: Collision | null): void {
    const self: NetPlayer | undefined = this.net;
    const body: RigidBody | undefined = this.rigidBody;

    if (self === undefined || body === undefined || collision === null) {
      return;
    }

    if (!other.hasComponent(Tag)) {
      return;
    }

    const tag: Tag = other.requireComponent(Tag);

    if (tag.value !== "Player") {
      return;
    }

    if (!reportsPair(this.entityId, other.id)) {
      return;
    }

    const otherNet: NetPlayer | undefined = other.getComponent(NetPlayer);
    const otherTransform: Transform2D | undefined = other.getComponent(Transform2D);
    const otherBody: RigidBody | undefined = other.getComponent(RigidBody);

    if (otherNet === undefined || otherTransform === undefined || otherBody === undefined) {
      return;
    }

    /* The Collision is borrowed: one instance re-targeted before every dispatch, and `readonly`
       stops neither the engine from rewriting it nor this script from keeping a stale handle.
       Read the point into plain numbers here, or two contacts in one tick queue two events both
       pointing at the last one. */
    const px: number = collision.point.x;
    const py: number = collision.point.y;

    this.outbox.push({
      k: "bump",
      t: this.outbox.tick,
      a: self.id,
      b: otherNet.id,
      px,
      py,
      s: impactSpeedBetween(
        this.transform.position,
        body.velocity,
        otherTransform.position,
        otherBody.velocity,
      ),
    });
  }
}

registerScriptMetadata(PlayerBumpReportScript, {
  exposed: {
    outbox: ScriptMetadata.field({ required: true }),
  },
});
