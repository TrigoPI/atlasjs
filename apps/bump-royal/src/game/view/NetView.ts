import type { NetId } from "../../net/protocol";

/* The client half of the NetId -> Entity mapping, mirroring NetPlayer on the server. The three
   mutable fields are the snapshot applier's per-entity correction state: keeping them here
   rather than in a parallel map ties their lifetime to the entity's. */
export class NetView {
  public readonly id: NetId;

  public errorX: number = 0;
  public errorY: number = 0;
  public extrapolating: boolean = false;

  public constructor(id: NetId) {
    this.id = id;
  }
}
