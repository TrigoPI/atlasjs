import type { NetId } from "../../net/protocol";

/* No tick is ever negative, so this can never be mistaken for a real teleport. */
export const NO_TELEPORT: number = -1;

/* The client half of the NetId -> Entity mapping, mirroring NetPlayer on the server. The
   mutable fields are the snapshot applier's per-entity correction state: keeping them here
   rather than in a parallel map ties their lifetime to the entity's. */
export class NetView {
  public readonly id: NetId;

  public errorX: number = 0;
  public errorY: number = 0;
  public extrapolating: boolean = false;

  /* Where and when a respawn event put this entity. The applier reads them to stop
     interpolating across the jump while its bracket still starts before it. */
  public teleportTick: number = NO_TELEPORT;
  public teleportX: number = 0;
  public teleportY: number = 0;

  public constructor(id: NetId) {
    this.id = id;
  }
}
