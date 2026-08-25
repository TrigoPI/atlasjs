---
name: occluder-ysort-feature
description: "Occluder Y-sort (occluders larger than a tile) — implemented & browser-verified 2026-08-03; shares its Tiled rectangle with the Phase-3 world-solidity colliders."
type: project
modified: 2026-08-03
---

On 2026-08-03, built **occluder Y-sort**: large occluders (walls / trees / buildings bigger than one tile) that must pass **in front of OR behind** the player — which the binary Ground/Overhead layers couldn't do.

Core model: an occluder = N **strips**, each a bag of tile instances with **one** sort key = `footY` (its foot/base line). A strip renders as a single `TileMapNode` on the `ySorted` `Entities` layer, so it interleaves with the player via the existing `applySortFields`/`RenderQueue`. **Split by depth (base line), never by height.** Visual granularity (instances) ≠ sort granularity (one key).

Authoring in Tiled — **naming convention is all-lowercase snake_case** (the user's choice; the code matches it): **tile layers** named `occluders_*` (e.g. `occluders_walls`, `occluders_trees`) — `MapBuilder` detects them via `layer.name.startsWith("occluders")`; the **object layer** is `occluder_regions` — `isOccluderRegion` matches via `groupPath.includes("occluder_regions")` (or property `occluder=true`). One tile layer **per tileset** (the user has multiple occluder tilesets by category). Drop one rectangle per occluder on `occluder_regions`; its bottom edge = the foot/sort line (property `slice: "single" | "perRow"`). A pure baker (`bakeOccluderStrips`, in `packages/gameplay/src/systems/utils/`) turns each rectangle into strips; `ingestOccluders` (app) spawns lightweight `OccluderStrip` entities parented to the Grid. **Backend 1 (static entities)** chosen; flyweight/zero-entity backend = backlog.

Design doc: `docs/gameplay/occluder-ysort.md` (the implementation-plan doc was removed after completion). **Implemented on branch `claude/feat/occluder-ysort` (subagent-driven, 5 tasks + 1 fix wave; gameplay 188/188 + tsc clean; whole-branch review opus = merge-ready), committed, and BROWSER-VERIFIED by the user** (player draws in front below the foot line, behind above). Follow-up bug fixed same day: `TiledDocument` was **dropping nameless objects** AND **omitting the object-layer name from `groupPath`**, so occluder rects weren't detected — fixed to keep nameless rects + include the objectgroup in `groupPath` (test: `apps/dino-brawl/test/tiled/ingestOccluders.test.ts`). Backlog: frame()-driven plugin-wiring test; overlapping-region dedup (spec §5 = first-rect-wins); dev-warn is layer-granularity only.

**Why:** unblocks correct sorting of decor taller/wider than the tile grid — the exact gap the user hit with the ground/overhead trick.

**How to apply:** feature is done. The **same `occluder_regions` rectangle** is the designed anchor for the Phase-3 world-solidity colliders (body-less `Collider2D`, layer `Occluder`) — the collision layer itself is already shipped (see [[next-feature-collisions]]); Phase 3 is the natural next feature. Repo execution style: subagent-driven, user commits each step (see [[execution-cadence-preference]], [[verify-against-committed-head]]); app browser-verify caveats: [[sandbox-browser-verify-gotchas]], [[vite-type-only-imports]].
