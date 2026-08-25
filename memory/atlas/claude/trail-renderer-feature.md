---
name: trail-renderer-feature
description: TrailRenderer shipped to a branch (not merged); the emission-resume clear rule and two browser-verification techniques worth reusing
type: project
---

TrailRenderer (Unity-style trails) built and **merged into dev 2026-08-23** (eb89339). Design: `docs/rendering/trails.md`; closed via `/atlas-done`, which opened RENDER-16..22 and GAMEPLAY-61/62.

Two things that were NOT obvious and cost real work:

**Emission-resume must clear the ribbon.** A segment means "the emitter travelled A→B"; if emission was off in between, that segment is a lie. On a dino-brawl combo the next attack starts one frame later, so the old points are still alive while the sword tip teleports ~100 units (pose jumps `angleOffset: 0` → `windupAngle`), producing a full-width streak across the character for `time` seconds. Fixed both ways: `TrailRenderSystem` clears on the rising edge of `emitting` (via `MountedTrail{node,emitting}`), plus a `TrailRendererCommand "none"|"clear"` on the component mirroring `AudioSource.command`. Found by static derivation in review, never observed — the preview pane throttles dino-brawl to 4fps where an attack completes between frames.

**Two browser-verification techniques that beat source probes** (see [[sandbox-browser-verify-gotchas]]):
- Import the built dist into the page — `await import("/@fs/<abs>/packages/nebula/dist/index.mjs")` — and call a renderer's `collect()` on a live stashed node. Isolates CPU geometry from the GPU path with no rebuild and no source edit.
- Inject a *second* node from the page with `time = 1e9` and a hand-emitted polyline to exercise batching and hard geometry (a 12-point zigzag = 11 consecutive ~90° reversals) without touching any source file.

Also: `apps/webgpu`'s `setInterval` loop is timer-throttled unless the tab really has focus, so ribbon *length* measured otherwise is meaningless; and `computer key` does not reach a document-level `keydown` listener — dispatch a real `KeyboardEvent` instead.
