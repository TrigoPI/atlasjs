---
name: gameplay-plugin-test-imports
description: "A `packages/gameplay` test that exercises the plugin must import components from `../src/`, never from `@atlasjs/gameplay` — the package name yields a second class identity and the systems silently see nothing."
type: reference
modified: 2026-09-04
---

`packages/gameplay/test/helpers/harness.ts` builds the engine from **sources**:

```ts
import { GameplayPlugin } from "../../src/GameplayPlugin";
```

So a test that imports the same component from the package name gets a **different class object** for it:

```ts
import { ParticleEmitter, Transform2D } from "@atlasjs/gameplay";   // → dist
import { ParticleEmitter, Transform2D } from "../src/components";   // → src, what the harness registered
```

`GameplayPlugin.defineComponents` registers the `src` identity in the `ComponentRegistry`; `world.addComponent(entity, <dist identity>)` registers a **second** `ComponentID` for what looks like the same class. Every system query then matches nothing.

**There is no error.** `addComponent` succeeds, the frame runs, and the symptom is a query that is simply always empty — in my case `world.hasComponent(entity, WorldTransform2D)` staying `false` forever, because `TransformPropagationSystem` was looking at the other `Transform2D`.

The trap has a second half: **a test can pass through this bug.** `packages/gameplay/test/occluder-plugin.test.ts` imports from `@atlasjs/gameplay` and is green, because it only asserts `typeof OccluderStrip === "function"` and that `addComponent` does not throw. Neither observes cross-system behaviour, so the dual identity never surfaces. Copying that file as a template for a test that *does* observe behaviour is how you land in it.

Stacked on top, and hit first: `@atlasjs/gameplay` resolves through `exports` → `dist`, so before `pnpm --filter @atlasjs/gameplay build` even the `typeof` check fails with `undefined`. Fixing only that makes the surface tests go green and leaves the behavioural ones red, which points suspicion at the feature rather than at the import.

**Why:** it cost a debugging detour on step 6 of the particle-system plan (2026-09-04). The four tests failed together, including a trivial `typeof`, which read as "the feature is broken" rather than "the import is wrong".

**How to apply:** in `packages/gameplay/test/`, import engine components and systems from `../src/…` whenever the test goes through `createHarness` or asserts on system behaviour. Reserve `@atlasjs/gameplay` for tests that deliberately check the published barrel — and remember those need `dist` rebuilt first. Related: [[vite-type-only-imports]] is the other import-shaped failure in this repo, and [[cpu-particles-feature]] is where this one was found.
