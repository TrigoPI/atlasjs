# AGENTS.md — @atlasjs/input

Input for AtlasJS: low-level device polling **and** a high-level named-action layer. Depends only on `@atlasjs/core`, `@atlasjs/math`, `@atlasjs/utils` — it knows **nothing** about the ECS (Nexus), rendering, or the scripting layer. The ECS integration lives in `@atlasjs/gameplay`; this package stays pure and reusable on its own.

> Design docs at the repo root: **`docs/gameplay/input-scripting.md`** (how scripts reach input — the façade in gameplay sits on this package's service) and **`docs/gameplay/input-actions.md`** (the named-action system, incl. the explicit "V1 limits & backlog" section). Read the latter before touching `public/actions/`.

## Two layers

1. **Device polling (the backend).** A frame-based snapshot of keyboard + pointer.
   - `Input` (interface, `public/Input.ts`) — the service contract: `isDown` (held), `isPressed` (pressed **this frame**), `isReleased` (released **this frame**), `pointer`, `keys`, `endFrame`.
   - `Key` (`public/Key.ts`) — the control vocabulary (letters, digits, arrows, modifiers, `MouseLeft`/`MouseRight`).
   - `InputPlugin` (`public/InputPlugin.ts`) — provides the `INPUT` service token, attaches a `DomInputBackend`, and registers `input.endFrame()` at the `update` lane **`Late`** stage. Edges (`pressed`/`released`) are set by DOM events and cleared once per frame at `Late` — so a consumer reading during `Logic` sees them for the whole frame.
   - `private/` — `BackendInput`/`BackendKeyboard`/`BackendPointer` (the mutable state behind the interface) and `DomInputBackend` (the only DOM-aware code).

2. **Named actions (`public/actions/`).** A device-agnostic abstraction on top of the polling layer — `if (jump.isPressed())`, `move.readValue()` — instead of hard-coded keys in game logic. **Pure: no ECS, no scheduler, no DOM.**
   - *Authoring (data):* `defineActions({...})` + builders `button()` / `value()` / `vector2()` produce a **serializable** `ActionMapDescriptor<T>` that preserves the name→kind mapping at the type level.
   - *Runtime:* `InputActionMap<T>` instantiates one action per spec; `map.update(input, dt)` samples every frame (rolls `previous ← current`); `map.get(name)` is typed by action kind (`ActionFor<T[K]["kind"]>`).
   - *Actions:* `ButtonAction` (`isDown` held, `isPressed`/`isReleased` edges — **same vocabulary as the backend**), `ValueAction` (`readValue(): number`, key 0/1 or signed axis), `Vector2Action` (`readValue(): Vec2`, **raw** composite — diagonals are not normalized in V1).

## Invariants — do not break

- **This package stays ECS-free and DOM-free above the backend.** `public/actions/` must never import Nexus, the scheduler, or `document`/`window`. Sampling takes an `Input` and a `dt` and computes — nothing more. The per-entity `PlayerInput` component + sampling system live in `@atlasjs/gameplay`.
- **`isDown` = held, `isPressed`/`isReleased` = this-frame edges.** One vocabulary across the backend, the `InputApi` façade (gameplay), and `ButtonAction`. Do not introduce a divergent naming (`wasPressedThisFrame`, `isPressed = held`, …).
- **Actions are sampled, not pulled.** Action state is `current` + `previous`, updated once per frame by `map.update`. Handles are **persistent** (mutated in place) — a holder keeps a stable ref. Don't recompute on read or re-mint action objects per access.
- **`dt` threads through `sample`/`update` even though V1 ignores it** — it's the seam for time-based interactions (hold/tap). Don't remove it.
- **Descriptors are pure data** (serializable-first, for a future editor). Keep builders producing plain specs; don't smuggle runtime objects into the descriptor.
- **`defineActions` typing is load-bearing.** `map.get(name)` is typed off the descriptor's name→kind map. Keep the generic chain (`ActionMapDescriptor<T>` → `ActionFor<T[K]["kind"]>`) intact.

## V1 is deliberately partial

No events/callbacks, interactions, processors (hence no normalization/deadzone), gamepad/analog, control schemes, device assignment, runtime rebinding, or asset (de)serialization. The runtime model leaves seams for all of these — see `docs/gameplay/input-actions.md` §"Coutures d'extensibilité" and §"Limites & manques V1" before extending.

## Build & test

`pnpm --filter @atlasjs/input build` (tsdown → `dist`, ESM + d.ts). `pnpm --filter @atlasjs/input test` (vitest; specs in `test/`). **Typecheck with `tsc --noEmit`** — never `tsc -b` on this package (it emits `.js`/`.d.ts` next to sources; the real build is tsdown → `dist`).
