---
name: cpu-particles-feature
description: "CPU particle system — shipped, browser-verified, and MERGED into dev (bd0a802, 2026-09-04, not pushed); reuses the sprite batch so nebula-webgpu is untouched."
type: project
modified: 2026-09-05
---

`ParticleEmitter` (gameplay) + `CPUParticleNode` / `CPUParticleNodeRenderer` (nebula). Design: `memory/atlas/rendering/particles.md` (`status: implemented`).

**State (corrected 2026-09-05):** 12 commits on `feat/claude/cpu-particles`, **merged into `dev` by `bd0a802`, still not pushed** (`origin/dev` is behind). The branch no longer exists locally. `215` nebula tests, `598` gameplay tests, monorepo `27/27`. Browser-verified at 60 fps in `apps/bump-royal`, including `simulationSpace: "world"` (particles stay put while the player moves away). **The effect at its real speed was never captured** — a 0.3 s burst finishes between two frames of a driven pane, so every screenshot used a deliberately exaggerated config. That proves the render path, not the tuning.

**A near-empty sprite under additive blend looks exactly like a broken render path.** The first demo attempt reused `shadow.png` and drew nothing. What settled it in one move: swap the texture for one whose visibility is certain, change nothing else. Reach for that before probing the pipeline.

**The result that shaped the whole design:** `SpriteBatch.add(model, uvRect, tint)` already takes a **per-instance tint**, and `TileMapBatcher` already proves one `DrawCommand` can carry N sprite instances. So particles got their own draw kind — one draw call per emitter, own culling, own sorting — with **zero changes to `@atlasjs/nebula-webgpu`**: no WGSL, no `WebGPU*Batch`, no `ResourceFactory` method. Everything is plain TypeScript, hence fully vitest-covered. Protect that property; backlog note `RENDER-26` (a leaner instance struct) deliberately gives it up and should only be opened once the gain is measured — and note its real figure is **64 bytes**, not the 48 first estimated: WGSL aligns `vec4` on 16, so a naive field order pads.

**GPU was not "barely harder".** There is no compute abstraction anywhere in nebula/nebula-webgpu — zero `@compute`, `getStorageLayout` hardcodes `visibility: VERTEX` + `read-only-storage`, and `WebGPUInstanceBufferPool` is a per-frame scratch pool reset at `beginFrame`, not persistent state. It would mean a new resource type *and* a new pass type in the backend-agnostic core, and it would not be vitest-testable.

**The real perf bottleneck is not the sim loop.** `BindingGroupLayoutHelper.packStorageArray` allocates a fresh `ArrayBuffer(stride × count)` per batch per frame — ~29 MB/s of garbage at 5 000 particles. That is `RENDER-27`, the first optimisation to reach for, and it benefits sprites/shapes/tilemaps/trails too. Every number in `particles.md` §7 is **arithmetic, never measured**.

Three bugs that only tests caught, worth expecting in any similar node:

1. **`worldMatrix` is one frame stale at `PreRender`.** The node bakes a world-space particle's position at spawn, but `SceneGraph.updateWorldMatrices()` runs at `Main`. The system must call `node.updateWorldMatrix()` itself. Fragile if the node is ever reparented — `RENDER-32`.
2. **Applying `state` every frame instead of on transition** pins the emitter clock at zero, so a `time: 0` burst fires 60×/s and prewarm loops. The symptom is not "prewarm loops", it is a firehose.
3. **A SoA array is referenced in five places** — declarations, ctor allocation, `setCapacity` resize, `kill` swap, spawn write. Forget it in `kill` and a recycled particle inherits the previous one's value: random flicker, no error. And a *shrink* test does not prove the resize: out-of-bounds `Float32Array` writes are silently dropped, so the test must **grow** capacity then spawn past the old bound.

Also: `applyConfig` deliberately skips `seed` (re-seeding a live emitter would jump its stream — `GAMEPLAY-119`), and `emit` rejects non-finite counts because on a cumulative counter one `emit(NaN)` poisons `pendingEmit` forever while `Infinity` hangs a counted drain.

Test trap found on the way: [[gameplay-plugin-test-imports]].
