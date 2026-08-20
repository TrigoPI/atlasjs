---
name: atlas-verify-webgpu
description: Use when verifying a rendering change in the browser for AtlasJS (apps/webgpu or apps/dino-brawl), or when the preview looks wrong for no obvious reason — covers the WGSL rebuild requirement, WebGPU compile errors that never surface as console errors, RAF throttling that produces a black canvas with zero errors, a dev server serving a stale scene after hot-reload, and a preview running on a different port than the one announced.
---

# WebGPU browser verification (AtlasJS)

Six pitfalls make browser verification misleading on this project. Ignoring them produces either a false negative, or an unfounded "it works".

## 1. Rebuild the backend after any `.wgsl` edit

Apps import packages through their `exports` field → `./dist`, and the `.wgsl` is **inlined into `dist` at build time**.

```bash
pnpm --filter @atlasjs/nebula-webgpu build
```

Restarting the dev server **is not enough**. HMR even less so. A `PostToolUse` hook does this automatically, but if the edit comes from elsewhere (git checkout, manual edit), the rebuild is the operator's responsibility.

## 2. A WGSL compile error is not a console error

It comes out as **`warn`** (`Error while parsing WGSL:`), then gets drowned under `Invalid RenderPipeline … due to a previous error` repeated at 60 fps.

- Read the console **without** the `onlyErrors` filter.
- For the exact error reliably, compile the shader in the page and read `getCompilationInfo()`.

## 3. `apps/dino-brawl` is throttled out of the foreground

Its loop runs on RAF: if the browser panel isn't in the foreground, you get a **black canvas at 0 fps with no error at all**. Bring the tab to the front before judging anything.

Programmatic canvas readback (`drawImage`/`getImageData`) returns empty for the same reason. It works on `apps/webgpu`, whose loop is a `setInterval`.

## 4. `fwidth` and non-uniform control flow

No `if` depending on `params` **before** a call to `fwidth`: it's a derivative builtin, WGSL forbids calling it in non-uniform control flow, and the shader then refuses to compile. Applies to any future extension (rounded corners, feather).

## 5. HMR sometimes serves a stale WebGPU scene

At the slightest doubt about what is on screen after a change, restart the dev server (`preview_stop` then `preview_start`) rather than trusting HMR. To inspect the real scene state without restarting, stash a reference on `window.__scene` and query it from the console or `javascript_tool`.

## 6. The announced preview port can differ from Vite's actual port

When the port is already taken, Vite silently picks another one while the harness still announces the first. Read `preview_logs` for the effective port before navigating, instead of trusting the port reported at startup.

## Verification order

1. `pnpm --filter @atlasjs/nebula-webgpu build` if a `.wgsl` has changed.
2. Open the preview on the port reported by `preview_logs`, **tab in the foreground**.
3. Read the **entire** console, not just the errors.
4. Confirm the render with a screenshot; never conclude from an empty readback without first ruling out throttling.
5. If the result looks stale, restart the dev server before investigating further.
