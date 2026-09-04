---
name: cpu-particles-feature
description: "CPU particle system on branch feat/claude/cpu-particles — engine side done and tested, never rendered on screen; reuses the sprite batch so nebula-webgpu is untouched."
type: project
modified: 2026-09-04
---

`ParticleEmitter` (gameplay) + `CPUParticleNode` / `CPUParticleNodeRenderer` (nebula). Design: `memory/atlas/rendering/particles.md` (`status: partial`).

**State on 2026-09-04:** 9 commits on `feat/claude/cpu-particles`, **not merged, not pushed**. `215` nebula tests, `598` gameplay tests, monorepo `27/27`. **Nothing has ever been displayed on screen** — step 7 of the plan (the `apps/bump-royal` demo, and therefore all browser verification) was blocked by the operator's uncommitted work on the five files it must touch: `config.ts`, `PlayerPrefab.ts`, `spawnPlayer.ts`, `loaders/AssetList.ts`, `loaders/ResourcesIndex.ts`.

**The result that shaped the whole design:** `SpriteBatch.add(model, uvRect, tint)` already takes a **per-instance tint**, and `TileMapBatcher` already proves one `DrawCommand` can carry N sprite instances. So particles got their own draw kind — one draw call per emitter, own culling, own sorting — with **zero changes to `@atlasjs/nebula-webgpu`**: no WGSL, no `WebGPU*Batch`, no `ResourceFactory` method. Everything is plain TypeScript, hence fully vitest-covered. Protect that property; [[cpu-particles-feature]]'s backlog note `RENDER-26` (lean 48-byte instance struct) deliberately gives it up and should only be opened once the gain is measured.

**GPU was not "barely harder".** There is no compute abstraction anywhere in nebula/nebula-webgpu — zero `@compute`, `getStorageLayout` hardcodes `visibility: VERTEX` + `read-only-storage`, and `WebGPUInstanceBufferPool` is a per-frame scratch pool reset at `beginFrame`, not persistent state. It would mean a new resource type *and* a new pass type in the backend-agnostic core, and it would not be vitest-testable.

**The real perf bottleneck is not the sim loop.** `BindingGroupLayoutHelper.packStorageArray` allocates a fresh `ArrayBuffer(stride × count)` per batch per frame — ~29 MB/s of garbage at 5 000 particles. That is `RENDER-27`, the first optimisation to reach for, and it benefits sprites/shapes/tilemaps/trails too. Every number in `particles.md` §7 is **arithmetic, never measured**.

Three bugs that only tests caught, worth expecting in any similar node:

1. **`worldMatrix` is one frame stale at `PreRender`.** The node bakes a world-space particle's position at spawn, but `SceneGraph.updateWorldMatrices()` runs at `Main`. The system must call `node.updateWorldMatrix()` itself. Fragile if the node is ever reparented — `RENDER-32`.
2. **Applying `state` every frame instead of on transition** pins the emitter clock at zero, so a `time: 0` burst fires 60×/s and prewarm loops. The symptom is not "prewarm loops", it is a firehose.
3. **A SoA array is referenced in five places** — declarations, ctor allocation, `setCapacity` resize, `kill` swap, spawn write. Forget it in `kill` and a recycled particle inherits the previous one's value: random flicker, no error. And a *shrink* test does not prove the resize: out-of-bounds `Float32Array` writes are silently dropped, so the test must **grow** capacity then spawn past the old bound.

Also: `applyConfig` deliberately skips `seed` (re-seeding a live emitter would jump its stream — `GAMEPLAY-119`), and `emit` rejects non-finite counts because on a cumulative counter one `emit(NaN)` poisons `pendingEmit` forever while `Infinity` hangs a counted drain.

Test trap found on the way: [[gameplay-plugin-test-imports]].
