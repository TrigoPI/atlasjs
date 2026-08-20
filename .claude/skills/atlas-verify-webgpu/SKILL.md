---
name: atlas-verify-webgpu
description: Use when verifying a change in the browser for AtlasJS (apps/webgpu or apps/dino-brawl), when the preview looks wrong for no obvious reason, or when driving the game to check gameplay behaviour — covers the WGSL rebuild requirement, WebGPU compile errors that never surface as console errors, RAF throttling that produces a black canvas with zero errors, a dev server serving a stale scene after hot-reload, a preview running on a different port than the one announced, and the input pitfalls that make simulated clicks and held keys silently do nothing.
---

# Browser verification (AtlasJS)

Nine pitfalls make browser verification misleading on this project. Ignoring them produces either a false negative, or an unfounded "it works".

Pitfalls 1-6 are about what the preview _shows_; 7-9 are about _driving_ the app to check behaviour, where a lost click looks exactly like a broken feature.

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

## 7. `javascript_tool` drops the pane out of the foreground

Each `javascript_tool` call tends to un-front the tab, so RAF re-throttles and the **next** simulated click is never consumed by an update tick — the input edge is polled per frame, and there is no frame. The click looks like it did nothing; nothing is broken.

- Sandwich every `javascript_tool` call between real `computer` `hover`/`click` calls to keep the loop running.
- **Never read verification state through `javascript_tool`.** Inject a `position: fixed` HUD `<div>`, have the instrumented code render into it, and read the value off the **screenshot**. That keeps `javascript_tool` out of the critical path entirely.
- The tab also silently flips back to the harness proxy URL, which serves a blank page. When a screenshot comes back blank, re-`navigate` to the port from `preview_logs` and `tabs_select` before concluding anything.

## 8. `computer key` cannot hold a key down

`repeat: 40` sends forty instant keydown/keyup pairs, and `duration` sends one instant pair. Movement is `dt`-based, so the character barely budges either way — this is not an input-binding bug.

To actually walk, dispatch a bare `keydown` (no `keyup`) on `[window, document, canvas]` via `javascript_tool`, then make two or three real `hover` calls so wall-clock frames elapse, then dispatch `keyup`. Two hovers is roughly enough to cross 150 world units.

## 9. At a throttled framerate a swing tunnels through a sensor

At 4 fps, `dt` is ~250 ms: a weapon hitbox teleports past its target between physics steps and `onTriggerEnter` never fires. Attacks read as misses even when the gizmos look like they overlap mid-swing.

Get the target overlapping the hitbox in its **resting** pose before attacking, or put the assertion in a unit test and use the browser only to confirm the wiring.

## Verification order

1. `pnpm --filter @atlasjs/nebula-webgpu build` if a `.wgsl` has changed.
2. Open the preview on the port reported by `preview_logs`, **tab in the foreground**.
3. Read the **entire** console, not just the errors.
4. Confirm the render with a screenshot; never conclude from an empty readback without first ruling out throttling.
5. If the result looks stale, restart the dev server before investigating further.
6. To check behaviour rather than pixels, instrument into an on-screen HUD and drive the app with real `computer` input, keeping `javascript_tool` out of the click path.
