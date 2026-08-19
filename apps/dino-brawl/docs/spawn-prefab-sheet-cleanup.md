# Dino-Brawl — Spawn → Prefab migration + centralized SpriteSheets + cleanup

**Date:** 2026-08-12
**Scope:** `apps/dino-brawl` only. No `@atlasjs/*` package changes.
**Status:** design approved, ready for implementation plan.

## Context

`apps/dino-brawl` is mid-refactor. Asset loading was already centralized into
`src/game/loaders/` (`ResourcesIndex` → `AssetList` → `AssetsLoader`, an atlas
keyed by logical name). Code-first prefabs were started in `src/game/prefabs/`
(`PlayerPrefab`, `ShadowPrefab`, `RunningParticlePrefab`) but are **not wired in**:
`ArenaScene` still calls `spawnPlayer`, which builds everything inline (sprite
sheets, clips, and two local `definePrefab` runtime prefabs). A `src/game/sheets/`
module was started (`SheetLoader` + `DinoSheet`) but is likewise unconsumed.

This refactor finishes three things at once:

1. **Centralize sprite sheets** the same way assets were centralized.
2. **Wire the prefabs in**, moving all inline construction out of `spawnPlayer`.
3. **Clean up** the resulting dead code and inconsistencies.

`spawnWorld` and `spawnCamera` are intentionally left untouched.

## Key technical constraint (drives the design)

`SpriteAnimation` (nebula) is **stateful** — it carries `currentFrameIndex`,
`playing`, `elapsedMs`. `Animator` adds clips **by reference** (no clone). So a
single `Record<string, SpriteAnimation>` shared across entities shares playback
state. That is fine for a single-instance entity (the player) but a bug for
multi-instance entities (running particles, spawned continuously).

`SpriteSheet` is **stateless** (frame regions only) → safe to build once and share.

**Resolution:** the sheet is built once; clips are (re)built on demand. Consumers
receive a **thunk** `createClips: () => Record<string, SpriteAnimation>` rather than
a frozen record. The player calls it once; a particle calls it on every spawn.

## Goals

- `sheets/` mirrors `loaders/` structure exactly.
- All entity construction lives in `prefabs/` files; `spawnPlayer` is a thin orchestrator.
- Prefabs never depend on `SheetLoader` — animation deps arrive as props/thunks.
- Fresh clip instances per animated entity instance.
- Remove dead code and unify inconsistent names.

## Non-goals

- No changes to `@atlasjs/*` packages.
- No change to `spawnWorld` / `spawnCamera`.
- No new engine features (no clip pooling, no sheet serialization).

## Architecture

### 1. `sheets/` module (mirror of `loaders/`)

| Assets (`loaders/`)           | Sheets (`sheets/`)                                             |
| ----------------------------- | ------------------------------------------------------------- |
| `ResourcesIndex` (raw paths)  | `sheets/sheets/*` — sheet **definitions** (builder + clips)   |
| `AssetList` (named descriptors) | **`SheetList`** (new) — named descriptors                   |
| `AssetsLoader` (atlas by name)  | **`SheetLoader`** (registry by logical name)                |
| `getAsset("sprite:x")`          | `createClips("sheet:dino")`                                 |

**`SheetList`** — one descriptor per sheet:

```ts
{ name: "sheet:dino", texture: "texture:yellow_dino", sheet: DinoSheetBuilder, clips: DinoClips }
```

**`SheetLoader`** (rewritten to mirror `AssetsLoader`):

- Constructed with the `AssetsLoader` (to resolve textures).
- `build()` iterates the `SheetList`: resolve the texture via
  `AssetsLoader.getAsset`, run the `SheetBuilder` **once** → `SpriteSheet`, store
  `{ sheet, clips: ClipBuilder }` **keyed by logical name** (`"sheet:dino"`), not by
  texture name.
- `createClips(name): Record<string, SpriteAnimation>` — runs the stored
  `ClipBuilder(sheet)` **fresh on every call** → new `SpriteAnimation` instances.

Replaces the current `SheetLoader.addSheet(...)` / `getClip(...)` API (which keyed
by texture name and returned a shared record).

**Sheet definitions** (`sheets/sheets/`):

- `DinoSheet` — keep, **fix `columns: 4` → `columns: 24`** (clips index up to frame 23).
- `RunningParticleSheet` — **new**: `SheetBuilder` (`columns: 8`) + `RunningParticleClips`
  (single `default` clip, `fps: 15`, `loop: false`), extracted from the current inline code.

### 2. `prefabs/` (all entity construction)

| Prefab                       | Props                                    | Notes                                                                 |
| ---------------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| `PlayerPrefab`               | `{ position, sprite, createClips }`      | **completed**: add `Animator` (via `createClips()`); `SpriteRenderer`. No `AudioSource` (player has none). |
| `ShadowPrefab`               | `{ position, sprite }`                    | `SpriteRenderer`; `Transform2D` from `@atlasjs/gameplay`               |
| `RunningParticlePrefab`      | via factory (see below)                  | **completed**: add `Animator`, `AudioSource`, sortingOrder, scale     |
| `RunningAudioPrefab` (new)   | via factory (see below)                  | extracts the inline `runningAudioPlayer`; randomized `volume`/`pitch`  |

**Runtime prefabs use a factory (option A).** The running scripts inject a prefab as
an exposed prop and call `instantiate(prefab, { position })` — they only supply
`position`. But the particle/audio prefabs also need `sprite`/`sound`/`createClips`.
So the file exports a **factory that captures those deps by closure** and returns a
`Prefab` whose params are just what the script passes:

```ts
// prefabs/RunningParticlePrefab.ts
export function createRunningParticlePrefab(deps: {
  sprite: Sprite;
  sound: AudioClip;
  createClips: () => Record<string, SpriteAnimation>;
}): Prefab<{ position: Vec2 }> { /* definePrefab({ build }) */ }

// prefabs/RunningAudioPrefab.ts
export function createRunningAudioPrefab(deps: { sound: AudioClip }): Prefab { /* ... */ }
```

`build` runs per `instantiate`, so calling `deps.createClips()` inside `build` yields
fresh clips per particle. `PlayerPrefab`/`ShadowPrefab` stay direct prefabs
(instantiated once by `spawnPlayer`).

### 3. `spawnPlayer` (thin orchestrator)

```ts
export async function spawnPlayer(ctx, spawnPosition, assetsLoader, sheetLoader) {
  // 1. pull assets (dino/shadow/particle sprites, grass sound) from assetsLoader
  // 2. dinoClips     = () => sheetLoader.createClips("sheet:dino")
  //    particleClips = () => sheetLoader.createClips("sheet:running_particle")
  // 3. instantiate PlayerPrefab { position, sprite, createClips: dinoClips }
  //    instantiate ShadowPrefab { position, sprite }; setParent(shadow, player)
  //    (PlayerPrefab attaches PlayerAnimationScript + PlayerMovementScript in its build)
  // 4. build runtime prefabs via factories:
  //      runningParticlePrefab = createRunningParticlePrefab({ sprite, sound, createClips: particleClips })
  //      runningAudioPrefab    = createRunningAudioPrefab({ sound })
  //    attach RunningParticleSpawnerScript { runningParticlePrefab }
  //    attach RunningAudioPlayerScript    { audioPrefab: runningAudioPrefab }
  return { player, shadow };
}
```

Instantiation goes through the `Instantiator` service (as scripts already do), keeping
`spawnPlayer` consistent with the prefab model. `spawnPlayer` keeps its place beside
`spawnWorld`/`spawnCamera`.

### 4. `ArenaScene` wiring

- After `AssetsLoader.load()`, construct `SheetLoader(assetsLoader)`, fill from
  `SheetList`, call `build()`.
- `initAssets`: add a `SheetList` loop alongside the existing
  `TextureList`/`SpriteList`/`AudioList` loops.
- Pass `sheetLoader` into `spawnPlayer(ctx, spawnPosition, assetsLoader, sheetLoader)`.

## Cleanup (the "clean dino-brawl" part)

- `SpriteRender` → **`SpriteRenderer`** everywhere in prefabs (one name).
- `Transform2D` imported from **`@atlasjs/gameplay`** (not `@atlasjs/math`) in
  `ShadowPrefab` / `RunningParticlePrefab`.
- `DinoSheet` → **`columns: 24`**.
- **`loaders/ResourcesPath.ts` stays.** It is *not* dead: `spawn/spawnWorld.ts`
  (`ResourcesPath.Map`, tilesets) and `spawn/spawnSword.ts`
  (`ResourcesPath.Sprites.Swords.Default`) still consume it, and `spawnWorld` is
  out of scope. `ResourcesPath` (map + tilesets + swords) and `ResourcesIndex`
  (the atlas-loaded dino/shadow/particle/audio) serve different consumers; the
  minor path overlap is left alone rather than risk touching `spawnWorld`.
- `spawnPlayer.ts`: all inline sheet/clip/`definePrefab` code removed.
- `sheets/SheetLoader.ts`: `getClip` (mis-keyed, shared record) replaced by
  `createClips(name)` (logical key, fresh clips).

## Verification

- `tsc --noEmit` on `dino-brawl`.
- **Vite type-only import guard** (known black-screen trap): `AudioClip`, `Sprite`,
  `SpriteSheet`, `SpriteAnimation` are used as **values** (constructors) → value
  imports, not `import type`.
- Prettier (scoped to touched `.ts` files) before staging.
- **Browser-verify** on the dev server: dino renders and animates
  (idle/run/sprint), shadow follows, running particles spawn and self-destroy, grass
  audio plays. Screenshot as proof.

## Implementation order (one task = one review/commit checkpoint)

1. `sheets/`: `SheetList` + `SheetLoader` rewrite + `RunningParticleSheet` + `DinoSheet` fix.
2. `prefabs/`: complete/fix the three existing + add `RunningAudioPrefab` + runtime factories.
3. `spawnPlayer` thinned + `ArenaScene` wiring.
4. Cleanup (`SpriteRender`→`SpriteRenderer`, `Transform2D` import source) + prettier + browser-verify.

Per project convention (superpowers): changes are left staged/unstaged for the user
to review and commit — no automatic commits.
