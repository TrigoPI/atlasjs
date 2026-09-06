import type { NetId } from "../../net/protocol";

/* Entity is not a wire identity: it packs a generation and its index is recycled, so a stale
   client reference could address a different player after a rejoin. NetId is the server's own
   monotonic counter, and this component is the entity -> id direction of that mapping. */
export class NetPlayer {
  public readonly id: NetId;

  public constructor(id: NetId) {
    this.id = id;
  }
}
