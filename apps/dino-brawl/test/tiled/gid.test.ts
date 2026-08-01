import { describe, expect, it } from "vitest";

import { resolveGid } from "../../src/game/tiled/gid";

describe("resolveGid", () => {
  it("passes plain gids through untouched", () => {
    expect(resolveGid(1)).toEqual({ gid: 1, flipX: false, flipY: false });
    expect(resolveGid(65)).toEqual({ gid: 65, flipX: false, flipY: false });
    expect(resolveGid(0)).toEqual({ gid: 0, flipX: false, flipY: false });
  });

  it("masks the horizontal flip flag (bit 31)", () => {
    expect(resolveGid(0x80000002)).toEqual({ gid: 2, flipX: true, flipY: false });
  });

  it("masks the vertical flip flag (bit 30)", () => {
    expect(resolveGid(0x40000003)).toEqual({ gid: 3, flipX: false, flipY: true });
  });

  it("masks combined flip flags including the diagonal (bit 29)", () => {
    expect(resolveGid(0xe0000004)).toEqual({ gid: 4, flipX: true, flipY: true });
  });
});
