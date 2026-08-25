---
name: atlas-verify-webgpu
description: Use when verifying a change in the browser for AtlasJS (apps/webgpu or apps/dino-brawl), when the preview looks wrong for no obvious reason, or when driving the game to check gameplay behaviour — covers the WGSL rebuild requirement, WebGPU compile errors that never surface as console errors, RAF throttling that produces a black canvas with zero errors, a dev server serving a stale scene after hot-reload, a preview running on a different port than the one announced, and the input pitfalls that make simulated clicks and held keys silently do nothing.
---

# Browser verification (AtlasJS)

Ten pitfalls make browser verification misleading on this project. Ignoring them produces either a false negative, or an unfounded "it works".

Pitfalls 1-6 are about what the preview _shows_; 7-10 are about _driving_ the app to check behaviour, where a lost click looks exactly like a broken feature.

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

Programmatic canvas readback (`drawImage`/`getImageData`) returns empty for the same reason. It works on `apps/webgpu`, whose loop is a `setInterval` — but **`setInterval` is throttled too**, to roughly 1 Hz, whenever the tab does not really have focus. The canvas keeps rendering, so nothing looks broken; what breaks is anything that *accumulates* over frames. A trail sampled once per tick built 2 points instead of 50 and read as "the feature doesn't work". Click inside the page to give it focus, and treat any accumulated quantity measured otherwise as unverified. Static geometry is still trustworthy at 1 Hz; growth over time is not.

## 4. `fwidth` and non-uniform control flow

No `if` depending on `params` **before** a call to `fwidth`: it's a derivative builtin, WGSL forbids calling it in non-uniform control flow, and the shader then refuses to compile. Applies to any future extension (rounded corners, feather).

## 5. HMR sometimes serves a stale WebGPU scene

At the slightest doubt about what is on screen after a change, restart the dev server (`preview_stop` then `preview_start`) rather than trusting HMR. To inspect the real scene state without restarting, stash a reference on `window.__scene` and query it from the console or `javascript_tool`.

## 6. The announced preview port can differ from Vite's actual port

When the port is already taken, Vite silently picks another one while the harness still announces the first. Read `preview_logs` for the effective port before navigating, instead of trusting the port reported at startup.

`navigate` to that effective port is then **refused** ("navigation was denied or failed") unless you pass `force: true`. The refusal is not a sign the port is wrong — retry the same URL with the flag before doubting the port.

## 6b. The pane must be *displayed*, not merely fronted

`tabs_select` fronts a tab; it does not display the Browser pane. While the pane is hidden, `computer{action:"screenshot"}` fails outright with "the Browser pane is not displayed, so the page is not compositing frames" — an explicit error, so it can't be mistaken for a broken render.

The subtler state is a pane that is displayed but small: the app renders, yet sits at **4 fps**. Nothing behavioural is observable there. A dino-brawl attack lasts ~0.23 s, so at 250 ms per frame an entire attack — wind-up, strike and recovery — completes *between two frames*. Once the pane is properly displayed the loop reaches 60 fps and `dt` drops to ~16 ms, which is the only regime where hit counts, phase motion and per-phase events mean anything. **Read the on-screen fps counter before trusting any behavioural observation**, and treat anything measured at 4 fps as unverified.

## 7. `javascript_tool` drops the pane out of the foreground

Each `javascript_tool` call tends to un-front the tab, so RAF re-throttles and the **next** simulated click is never consumed by an update tick — the input edge is polled per frame, and there is no frame. The click looks like it did nothing; nothing is broken.

- Sandwich every `javascript_tool` call between real `computer` `hover`/`click` calls to keep the loop running.
- **Never read verification state through `javascript_tool`.** Inject a `position: fixed` HUD `<div>`, have the instrumented code render into it, and read the value off the **screenshot**. That keeps `javascript_tool` out of the critical path entirely.
- **Prefer instrumenting the source over injecting a probe.** `javascript_tool` sometimes detaches the page from the tab outright — subsequent `computer` calls fail with "No site is open in this tab", and the only recovery is a `navigate` reload, which destroys any injected HUD or monkey-patch. An injected probe can therefore become unrecoverable. A temporary `console.log` added to the **source file**, read back with `read_console_messages`, survives every reload, never touches the tab, and costs one revert at the end. Tag it with a unique marker (pitfall 10) and confirm the dev server is really serving it — `curl http://localhost:<vite-port>/src/<path>.ts | grep <marker>` — before concluding from its absence that the code did not run.
- The tab also silently flips back to the harness proxy URL, which serves a blank page. When a screenshot comes back blank, re-`navigate` to the port from `preview_logs` and `tabs_select` before concluding anything.

### A synthetic pointer press never survives

`javascript_tool` **stops the RAF loop entirely** (instrument a frame counter: it stays at 0 for the whole call), and un-fronting the tab fires `blur` on `window`, which `DomInputBackend` handles with `input.clearAll()`. So a `pointerdown` dispatched from `javascript_tool` is wiped before a single frame observes it — holding the button across hovers doesn't help.

`isPressed` is an **edge** (`current && !previous`, flipped in `endFrame`), so a real `computer left_click` is also lost whenever no frame lands between its down and its up — at 4 fps, most of them are. The recipe that lands: `hover` → `left_click` → `hover`, on the same coordinates, **retried two or three times**. A lost click and a broken attack look identical, so never conclude from one attempt.

## 8. `computer key` cannot hold a key down

`repeat: 40` sends forty instant keydown/keyup pairs, and `duration` sends one instant pair. Movement is `dt`-based, so the character barely budges either way — this is not an input-binding bug.

To actually walk, dispatch a bare `keydown` (no `keyup`) on `[window, document, canvas]` via `javascript_tool`, then make two or three real `hover` calls so wall-clock frames elapse, then dispatch `keyup`. Two hovers is roughly enough to cross 150 world units.

## 9. At a throttled framerate a swing tunnels through a sensor

At 4 fps, `dt` is ~250 ms: a weapon hitbox teleports past its target between physics steps and `onTriggerEnter` never fires. Attacks read as misses even when the gizmos look like they overlap mid-swing.

Get the target overlapping the hitbox in its **resting** pose before attacking, or put the assertion in a unit test and use the browser only to confirm the wiring.

## 10. The console buffer outlives the page

`read_console_messages` keeps history across reloads, and `console.clear()` does not empty it — a log line from a previous bundle reads exactly like a fresh one. Before driving anything, log a unique marker (`console.log("[Probe] ...")`) and only trust lines that appear **after** it. Also check the format of what you read: a probe line in an older shape means the browser is running a stale module, even when `curl http://localhost:<port>/src/…` shows the server serving the new one.

## 11. Two ways to interrogate the engine without touching a source file

Both avoid the rebuild-and-revert cycle of a source probe (pitfall 7), and neither can leave the tree dirty.

**Import the built dist into the page.** Vite serves workspace packages from `/@fs/<abs path>/packages/<pkg>/dist/index.mjs` — the exact URL the app itself imports, so it is the *same module instance*, and `instanceof` holds against the app's own objects. From `javascript_tool` you can therefore construct an engine class and run it against live state:

```js
(async () => {
  const N = await import("/@fs/<abs>/packages/nebula/dist/index.mjs");
  const M = await import("/@fs/<abs>/packages/math/dist/index.mjs");
  const cmd = new N.TrailNodeRenderer().collect(globalThis.trail, new M.Bound(-1e5, -1e5, 2e5, 2e5), new M.Bound());
  return JSON.stringify({ cull: cmd === null, count: cmd && cmd.pointCount });
})()
```

That single call separates "the CPU side produced nothing" from "the GPU side drew nothing" — the question that otherwise costs a shader probe and two rebuilds. Note the async IIFE: `javascript_tool` rejects a bare top-level `await`. And beware `JSON.stringify` turning `NaN` into `null`, which reads exactly like a missing field.

**Inject a second node to exercise a path the app never hits.** Get the scene root off any stashed node (`node.getParent()`), build a sibling with a lifetime long enough to be static (`time = 1e9`), and hand-emit a polyline. This exercised, in one call and with no source edit: multi-node batch merging (two nodes sharing a blend mode → one draw), and a geometry case far harsher than the app produces (a 12-point zigzag = 11 consecutive ~90° reversals, every corner checkable at once). Remove it with `removeFromParent()` when done.

## 12. `computer key` does not reach a document-level listener

`computer {action: "key"}` delivers to the focused element. A `document.addEventListener("keydown", …)` — the shape most demo scaffolding uses — never sees it, even after clicking into the page. The keypress silently does nothing, which looks exactly like a broken key binding.

Dispatch a real event instead:

```js
document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyT", key: "t", bubbles: true }))
```

This is the opposite of pitfall 8, where `javascript_tool` is the wrong tool for *held* keys because it stops the loop. For a one-shot toggle read off `document`, it is the only thing that lands.

## 13. A sub-second effect cannot be sampled at the pane's framerate — exaggerate it instead

A dash lasts 0.18 s. Even once the pane reaches 60 fps, the round-trip of a `computer{action:"screenshot"}` call is longer than that, and the pane drops back to 4 fps as soon as it is driven — where the whole effect completes *between two frames*. Retrying the capture is not a strategy: it produces a stream of screenshots showing nothing, which reads exactly like a broken feature.

Split the question in two instead, and answer each where it can actually be answered:

- **Do the timings hold?** That belongs in unit tests, which already run at arbitrary `dt`. Never try to measure a duration or a cadence through the pane.
- **Does it draw at all, in the right place, with the right orientation and the right fade?** That is what only the browser can answer — so make the effect big enough and slow enough to be sampled. Temporarily override the tuning at the call site (prefab, scene) to stretch the duration *and* the distance, keeping the speed realistic so the stamps stay spatially separated. Slowing the effect **without** lengthening its path is the trap: the copies pile up on top of the emitter and the screen looks empty.

On the dash this meant `duration 0.18 → 1.75`, `distance 220 → 700`, `interval 0.04 → 0.25`, `time 0.22 → 4`, which turned an invisible flicker into four clearly separated ghosts. Revert the override the moment the screenshot is taken, and say plainly in the write-up that the real-speed render was never captured — the exaggerated run proves the *render path*, not the tuning.

Pair it with a numeric probe in the system itself: a frozen `x` that stays constant across frames while the emitter moves away proves snapshot semantics far better than any screenshot, and a monotonically decreasing tint alpha proves the fade. Both survive a framerate the eye cannot use.

## Verification order

1. `pnpm --filter @atlasjs/nebula-webgpu build` if a `.wgsl` has changed.
2. Open the preview on the port reported by `preview_logs`, **tab in the foreground**.
3. Read the **entire** console, not just the errors.
4. Confirm the render with a screenshot; never conclude from an empty readback without first ruling out throttling.
5. If the result looks stale, restart the dev server before investigating further.
6. To check behaviour rather than pixels, instrument into an on-screen HUD and drive the app with real `computer` input, keeping `javascript_tool` out of the click path.
