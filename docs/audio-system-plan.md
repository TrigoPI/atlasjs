# Audio System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sound to AtlasJS — a new `@atlasjs/audio` backend package (SFX one-shots + looping music + master/per-source volume) plus its ECS integration in `@atlasjs/gameplay`.

**Architecture:** Split façon `@atlasjs/input`. The pure, ECS-free backend (`AudioEngine` owning the Web Audio graph, `AudioClipAsset`/`AudioLoader`/`AudioClip`, `AudioPlugin` providing `AUDIO_ENGINE`) lives in `@atlasjs/audio`. The ECS/scripting integration (`AudioSource` component, `AudioSystem` reconciliation, `AudioApi` script façade) lives in `@atlasjs/gameplay`, wired by `GameplayPlugin` — exactly like `PlayerInput`/`PlayerInputSystem`/`InputApi`. Design spec: [`docs/gameplay/audio.md`](gameplay/audio.md).

**Tech Stack:** TypeScript (ES2022, strict), Web Audio API, `@atlasjs/assets` (asset system), `@atlasjs/nexus` (ECS), `@atlasjs/core` (plugin/scheduler/DI), tsdown (build), vitest (test).

## Global Constraints

- **Always type the code**, even trivially — function params, variables, class fields (root `CLAUDE.md`).
- **No comments** in code (root `CLAUDE.md`).
- **Typecheck with `tsc --noEmit`**, never `tsc -b` (emits artifacts next to sources). Build is `tsdown` → `dist`.
- **Acyclic dependencies:** `@atlasjs/audio` depends only on `@atlasjs/core`, `@atlasjs/assets`, `@atlasjs/utils` — it must **never** import `@atlasjs/nexus` or `@atlasjs/gameplay`. `@atlasjs/gameplay` gains a dep on `@atlasjs/audio` (one-way).
- **Tests run in plain node (no jsdom).** The `AudioEngine` guards `window`/`document` (SSR-safe) and accepts an injectable `EventTarget` + visibility-doc, so its DOM behavior is tested with a `new EventTarget()` and a fake doc — no browser environment needed. Do **not** add jsdom.
- **Naming:** `*Asset` / `*Loader` / bare-noun resource (`AudioClip`) / `*System` / suffix-less component (`AudioSource`) / `*Api` / `*Plugin` / SCREAMING_SNAKE token (`AUDIO_ENGINE`).
- **Cross-package deps** use `workspace:*`. After editing any `package.json` deps, run `pnpm install` from the repo root.
- **A package importing `@atlasjs/audio` resolves it from its `dist`** (the `exports` map points at `./dist`). So `pnpm --filter @atlasjs/audio build` must run before `@atlasjs/gameplay` typechecks/tests against it (Tasks 5+); likewise rebuild `@atlasjs/gameplay` before the vite app (Task 8).
- **Commits (user workflow):** per the user's cadence, the agent stages changes and runs the verification commands; **the user reviews and commits each task**. Suggested commit messages are given per task — do **not** run `git commit` unless the user asks. Before staging, run `pnpm exec prettier --write` on the touched `.ts` files (the repo has a `.prettierrc`; scope to touched files, never repo-wide). Do **not** reformat `docs/*.md`.
- **After implementation**, refresh the code graph with `graphify update .` (AST-only, no API cost) — a local pre-commit hook may already do this.
- Commit messages end with the trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

### Task 1: Scaffold `@atlasjs/audio` + asset descriptors (`AudioClipAsset`, `AudioClip`)

Creates the package and its two pure, dependency-light data types (no Web Audio, no engine yet).

**Files:**
- Create: `packages/audio/package.json`
- Create: `packages/audio/tsconfig.json`
- Create: `packages/audio/tsdown.config.ts`
- Create: `packages/audio/vitest.config.ts`
- Create: `packages/audio/src/index.ts`
- Create: `packages/audio/src/assets/AudioClipAsset.ts`
- Create: `packages/audio/src/assets/AudioClip.ts`
- Test: `packages/audio/test/audio-assets.test.ts`

**Interfaces:**
- Consumes: `Asset`, `Resource` from `@atlasjs/assets`.
- Produces:
  - `class AudioClipAsset implements Asset` — `new AudioClipAsset(source: string, options?: { id?: string })`; readonly `type: "audio"`, `id: string`, `source: string`.
  - `class AudioClip implements Resource` — `new AudioClip(id: string, buffer: AudioBuffer)`; readonly `id: string`, `buffer: AudioBuffer`; getter `duration: number`; `destroy(): void`.

- [ ] **Step 1: Create the package config files**

`packages/audio/package.json`:
```json
{
  "name": "@atlasjs/audio",
  "type": "module",
  "version": "0.0.1",
  "private": true,
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "import": "./dist/index.mjs",
      "default": "./dist/index.mjs"
    }
  },
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "test": "vitest run",
    "clean": "rimraf dist",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@atlasjs/assets": "workspace:*",
    "@atlasjs/core": "workspace:*",
    "@atlasjs/utils": "workspace:*"
  }
}
```

`packages/audio/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

`packages/audio/tsdown.config.ts`:
```ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  unbundle: true,
});
```

`packages/audio/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __DEV__: "false",
    __CONSOLE_TRANSPORT__: "false",
    __WEBSOCKET_TRANSPORT__: "false",
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Link the new package into the workspace**

Run: `pnpm install`
Expected: completes; `@atlasjs/audio` is now linked in the workspace (pnpm auto-includes `packages/*`).

- [ ] **Step 3: Write the failing test**

`packages/audio/test/audio-assets.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import { AudioClipAsset } from "../src/assets/AudioClipAsset";
import { AudioClip } from "../src/assets/AudioClip";

describe("AudioClipAsset", () => {
  it("derives a deterministic id from the source", () => {
    const asset: AudioClipAsset = new AudioClipAsset("sfx/hit.wav");
    expect(asset.type).toBe("audio");
    expect(asset.id).toBe("audio:sfx/hit.wav");
    expect(asset.source).toBe("sfx/hit.wav");
  });

  it("honors an explicit id override", () => {
    const asset: AudioClipAsset = new AudioClipAsset("sfx/hit.wav", { id: "custom" });
    expect(asset.id).toBe("custom");
  });
});

describe("AudioClip", () => {
  it("exposes id, buffer and duration, and destroy is a no-op", () => {
    const buffer: AudioBuffer = { duration: 2.5 } as AudioBuffer;
    const clip: AudioClip = new AudioClip("audio:x", buffer);
    expect(clip.id).toBe("audio:x");
    expect(clip.buffer).toBe(buffer);
    expect(clip.duration).toBe(2.5);
    expect(() => clip.destroy()).not.toThrow();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @atlasjs/audio test`
Expected: FAIL — cannot resolve `../src/assets/AudioClipAsset` / `../src/assets/AudioClip`.

- [ ] **Step 5: Implement the asset types**

`packages/audio/src/assets/AudioClipAsset.ts`:
```ts
import { Asset } from "@atlasjs/assets";

export interface AudioClipAssetOptions {
  readonly id?: string;
}

export class AudioClipAsset implements Asset {
  public readonly type: string = "audio";
  public readonly id: string;
  public readonly source: string;

  public constructor(source: string, options?: AudioClipAssetOptions) {
    this.source = source;
    this.id = options?.id ?? `audio:${source}`;
  }
}
```

`packages/audio/src/assets/AudioClip.ts`:
```ts
import { Resource } from "@atlasjs/assets";

export class AudioClip implements Resource {
  public readonly id: string;
  public readonly buffer: AudioBuffer;

  public constructor(id: string, buffer: AudioBuffer) {
    this.id = id;
    this.buffer = buffer;
  }

  public get duration(): number {
    return this.buffer.duration;
  }

  public destroy(): void {}
}
```

`packages/audio/src/index.ts`:
```ts
export * from "./assets/AudioClipAsset";
export * from "./assets/AudioClip";
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @atlasjs/audio test`
Expected: PASS (5 assertions across 3 tests).

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @atlasjs/audio exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Stage for user commit**

Suggested message: `feat(audio): scaffold @atlasjs/audio + AudioClipAsset/AudioClip`
Stage: `packages/audio/` and the root `pnpm-lock.yaml`.

---

### Task 2: `AudioEngine` + `AudioVoice`/`Voice` (Web Audio backend core)

The single owner of the Web Audio graph: master gain, one-shot playback, live voices, autoplay-unlock gesture, tab-visibility pause, teardown. **Injectable + SSR-safe** so it tests in plain node.

**Files:**
- Create: `packages/audio/src/AudioVoice.ts`
- Create: `packages/audio/src/Voice.ts`
- Create: `packages/audio/src/AudioEngine.ts`
- Create: `packages/audio/test/helpers/fakeAudioContext.ts`
- Test: `packages/audio/test/audio-engine.test.ts`
- Modify: `packages/audio/src/index.ts`

**Interfaces:**
- Consumes: `AudioClip` (Task 1).
- Produces:
  - `interface AudioVoice` — `apply(volume: number, muted: boolean): void`, `stop(): void`, readonly `finished: boolean`.
  - `interface VisibilityDoc` — `readonly hidden: boolean`, `addEventListener(type, () => void)`, `removeEventListener(type, () => void)`.
  - `interface AudioEngineOptions` — `{ target?: EventTarget; doc?: VisibilityDoc }`.
  - `class AudioEngine` — `new AudioEngine(ctx?: AudioContext, options?: AudioEngineOptions)`; `decode(data: ArrayBuffer): Promise<AudioBuffer>`; `playOneShot(clip: AudioClip, volume?: number): void`; `createVoice(clip: AudioClip, opts: { loop: boolean; volume: number; mute: boolean }): AudioVoice`; `masterVolume: number` (get/set); `muted: boolean` (get/set); `destroy(): void`.
  - `class Voice implements AudioVoice` — internal, **not** exported from the barrel.

- [ ] **Step 1: Add the reusable fake AudioContext test helper**

`packages/audio/test/helpers/fakeAudioContext.ts`:
```ts
export class FakeGainNode {
  public gain: { value: number } = { value: 1 };
  public connections: unknown[] = [];
  public disconnected: boolean = false;
  public connect(node: unknown): void {
    this.connections.push(node);
  }
  public disconnect(): void {
    this.disconnected = true;
  }
}

export class FakeBufferSourceNode {
  public buffer: unknown = null;
  public loop: boolean = false;
  public started: boolean = false;
  public stopped: boolean = false;
  public disconnected: boolean = false;
  public onended: (() => void) | null = null;
  public connect(_node: unknown): void {}
  public disconnect(): void {
    this.disconnected = true;
  }
  public start(): void {
    this.started = true;
  }
  public stop(): void {
    this.stopped = true;
  }
}

export class FakeAudioContext {
  public state: string = "suspended";
  public resumeCalls: number = 0;
  public suspendCalls: number = 0;
  public closed: boolean = false;
  public readonly destination: object = {};
  public readonly gains: FakeGainNode[] = [];
  public readonly sources: FakeBufferSourceNode[] = [];

  public createGain(): FakeGainNode {
    const gain: FakeGainNode = new FakeGainNode();
    this.gains.push(gain);
    return gain;
  }
  public createBufferSource(): FakeBufferSourceNode {
    const source: FakeBufferSourceNode = new FakeBufferSourceNode();
    this.sources.push(source);
    return source;
  }
  public async decodeAudioData(_data: ArrayBuffer): Promise<AudioBuffer> {
    return { duration: 1 } as AudioBuffer;
  }
  public async resume(): Promise<void> {
    this.resumeCalls++;
    this.state = "running";
  }
  public async suspend(): Promise<void> {
    this.suspendCalls++;
    this.state = "suspended";
  }
  public async close(): Promise<void> {
    this.closed = true;
    this.state = "closed";
  }
}
```

- [ ] **Step 2: Write the failing test**

`packages/audio/test/audio-engine.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import { AudioEngine, VisibilityDoc } from "../src/AudioEngine";
import { AudioClip } from "../src/assets/AudioClip";
import {
  FakeAudioContext,
  FakeBufferSourceNode,
} from "./helpers/fakeAudioContext";

class FakeDoc implements VisibilityDoc {
  public hidden: boolean = false;
  private readonly listeners: Map<string, () => void> = new Map();
  public addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, listener);
  }
  public removeEventListener(type: string): void {
    this.listeners.delete(type);
  }
  public fire(type: string): void {
    this.listeners.get(type)?.();
  }
  public has(type: string): boolean {
    return this.listeners.has(type);
  }
}

const clip: AudioClip = new AudioClip("audio:x", { duration: 1 } as AudioBuffer);

function make(): {
  engine: AudioEngine;
  ctx: FakeAudioContext;
  target: EventTarget;
  doc: FakeDoc;
} {
  const ctx: FakeAudioContext = new FakeAudioContext();
  const target: EventTarget = new EventTarget();
  const doc: FakeDoc = new FakeDoc();
  const engine: AudioEngine = new AudioEngine(ctx as unknown as AudioContext, {
    target,
    doc,
  });
  return { engine, ctx, target, doc };
}

describe("AudioEngine", () => {
  it("creates and connects a master gain to the destination", () => {
    const { engine, ctx } = make();
    expect(ctx.gains).toHaveLength(1);
    expect(ctx.gains[0].connections).toContain(ctx.destination);
    engine.destroy();
  });

  it("playOneShot wires a source through a gain into master and starts it", () => {
    const { engine, ctx } = make();
    engine.playOneShot(clip, 0.5);
    const source: FakeBufferSourceNode = ctx.sources[0];
    expect(source.buffer).toBe(clip.buffer);
    expect(source.started).toBe(true);
    engine.destroy();
  });

  it("masterVolume and muted drive the master gain", () => {
    const { engine, ctx } = make();
    engine.masterVolume = 0.3;
    expect(ctx.gains[0].gain.value).toBeCloseTo(0.3);
    engine.muted = true;
    expect(ctx.gains[0].gain.value).toBe(0);
    engine.muted = false;
    expect(ctx.gains[0].gain.value).toBeCloseTo(0.3);
    engine.destroy();
  });

  it("createVoice returns a live handle whose apply and stop drive the nodes", () => {
    const { engine, ctx } = make();
    const voice = engine.createVoice(clip, { loop: true, volume: 1, mute: false });
    const source: FakeBufferSourceNode = ctx.sources[0];
    expect(source.loop).toBe(true);
    expect(source.started).toBe(true);
    voice.apply(0.2, false);
    expect(ctx.gains[1].gain.value).toBeCloseTo(0.2);
    voice.apply(0.2, true);
    expect(ctx.gains[1].gain.value).toBe(0);
    expect(voice.finished).toBe(false);
    voice.stop();
    expect(source.stopped).toBe(true);
    expect(voice.finished).toBe(true);
    engine.destroy();
  });

  it("marks a voice finished when its source ends naturally", () => {
    const { engine, ctx } = make();
    const voice = engine.createVoice(clip, { loop: false, volume: 1, mute: false });
    ctx.sources[0].onended?.();
    expect(voice.finished).toBe(true);
    engine.destroy();
  });

  it("resumes the context on the first gesture, then stops listening", async () => {
    const { engine, ctx, target } = make();
    target.dispatchEvent(new Event("pointerdown"));
    await Promise.resolve();
    expect(ctx.resumeCalls).toBe(1);
    target.dispatchEvent(new Event("pointerdown"));
    await Promise.resolve();
    expect(ctx.resumeCalls).toBe(1);
    engine.destroy();
  });

  it("suspends on tab hide and resumes on show once unlocked", async () => {
    const { engine, ctx, target, doc } = make();
    target.dispatchEvent(new Event("pointerdown"));
    await Promise.resolve();
    doc.hidden = true;
    doc.fire("visibilitychange");
    expect(ctx.suspendCalls).toBe(1);
    doc.hidden = false;
    doc.fire("visibilitychange");
    expect(ctx.resumeCalls).toBe(2);
    engine.destroy();
  });

  it("destroy closes the context and removes the visibility listener", () => {
    const { engine, ctx, doc } = make();
    engine.destroy();
    expect(ctx.closed).toBe(true);
    expect(doc.has("visibilitychange")).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @atlasjs/audio test audio-engine`
Expected: FAIL — cannot resolve `../src/AudioEngine`.

- [ ] **Step 4: Implement `AudioVoice` and `Voice`**

`packages/audio/src/AudioVoice.ts`:
```ts
export interface AudioVoice {
  readonly finished: boolean;
  apply(volume: number, muted: boolean): void;
  stop(): void;
}
```

`packages/audio/src/Voice.ts`:
```ts
import { AudioVoice } from "./AudioVoice";

export class Voice implements AudioVoice {
  public finished: boolean = false;
  private readonly source: AudioBufferSourceNode;
  private readonly gain: GainNode;

  public constructor(source: AudioBufferSourceNode, gain: GainNode) {
    this.source = source;
    this.gain = gain;
    this.source.onended = (): void => {
      this.finished = true;
    };
  }

  public apply(volume: number, muted: boolean): void {
    this.gain.gain.value = muted ? 0 : Math.max(0, volume);
  }

  public stop(): void {
    this.finished = true;
    try {
      this.source.stop();
    } catch {
      void 0;
    }
    this.source.disconnect();
    this.gain.disconnect();
  }
}
```

- [ ] **Step 5: Implement `AudioEngine`**

`packages/audio/src/AudioEngine.ts`:
```ts
import { AudioClip } from "./assets/AudioClip";
import { AudioVoice } from "./AudioVoice";
import { Voice } from "./Voice";

export interface VisibilityDoc {
  readonly hidden: boolean;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface AudioEngineOptions {
  target?: EventTarget;
  doc?: VisibilityDoc;
}

const GESTURE_EVENTS: readonly string[] = ["pointerdown", "keydown", "touchstart"];

export class AudioEngine {
  private readonly ctx: AudioContext;
  private readonly target: EventTarget | null;
  private readonly doc: VisibilityDoc | null;
  private readonly master: GainNode;
  private _masterVolume: number = 1;
  private _muted: boolean = false;
  private unlocked: boolean = false;
  private readonly onGesture: () => void;
  private readonly onVisibility: () => void;

  public constructor(ctx: AudioContext = new AudioContext(), options?: AudioEngineOptions) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(ctx.destination);

    this.target =
      options?.target ?? (typeof window !== "undefined" ? window : null);
    this.doc =
      options?.doc ??
      (typeof document !== "undefined" ? (document as VisibilityDoc) : null);

    this.onGesture = (): void => {
      void this.unlock();
    };
    this.onVisibility = (): void => {
      this.handleVisibility();
    };

    if (this.target !== null) {
      for (const type of GESTURE_EVENTS) {
        this.target.addEventListener(type, this.onGesture);
      }
    }
    if (this.doc !== null) {
      this.doc.addEventListener("visibilitychange", this.onVisibility);
    }
  }

  public decode(data: ArrayBuffer): Promise<AudioBuffer> {
    return this.ctx.decodeAudioData(data);
  }

  public playOneShot(clip: AudioClip, volume: number = 1): void {
    const source: AudioBufferSourceNode = this.ctx.createBufferSource();
    source.buffer = clip.buffer;
    const gain: GainNode = this.ctx.createGain();
    gain.gain.value = Math.max(0, volume);
    source.connect(gain);
    gain.connect(this.master);
    source.onended = (): void => {
      source.disconnect();
      gain.disconnect();
    };
    source.start();
  }

  public createVoice(
    clip: AudioClip,
    opts: { loop: boolean; volume: number; mute: boolean },
  ): AudioVoice {
    const source: AudioBufferSourceNode = this.ctx.createBufferSource();
    source.buffer = clip.buffer;
    source.loop = opts.loop;
    const gain: GainNode = this.ctx.createGain();
    gain.gain.value = opts.mute ? 0 : Math.max(0, opts.volume);
    source.connect(gain);
    gain.connect(this.master);
    const voice: Voice = new Voice(source, gain);
    source.start();
    return voice;
  }

  public get masterVolume(): number {
    return this._masterVolume;
  }
  public set masterVolume(value: number) {
    this._masterVolume = Math.max(0, value);
    this.applyMaster();
  }
  public get muted(): boolean {
    return this._muted;
  }
  public set muted(value: boolean) {
    this._muted = value;
    this.applyMaster();
  }

  public destroy(): void {
    if (this.target !== null) {
      for (const type of GESTURE_EVENTS) {
        this.target.removeEventListener(type, this.onGesture);
      }
    }
    if (this.doc !== null) {
      this.doc.removeEventListener("visibilitychange", this.onVisibility);
    }
    void this.ctx.close();
  }

  private applyMaster(): void {
    this.master.gain.value = this._muted ? 0 : this._masterVolume;
  }

  private async unlock(): Promise<void> {
    if (this.unlocked) {
      return;
    }
    this.unlocked = true;
    if (this.target !== null) {
      for (const type of GESTURE_EVENTS) {
        this.target.removeEventListener(type, this.onGesture);
      }
    }
    try {
      await this.ctx.resume();
    } catch {
      void 0;
    }
  }

  private handleVisibility(): void {
    if (this.doc === null) {
      return;
    }
    if (this.doc.hidden) {
      void this.ctx.suspend();
    } else if (this.unlocked) {
      void this.ctx.resume();
    }
  }
}
```

- [ ] **Step 6: Export the public surface (not `Voice`)**

Replace `packages/audio/src/index.ts` with:
```ts
export * from "./assets/AudioClipAsset";
export * from "./assets/AudioClip";
export * from "./AudioVoice";
export * from "./AudioEngine";
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm --filter @atlasjs/audio test`
Expected: PASS (all `AudioEngine` cases + the Task 1 asset cases).

- [ ] **Step 8: Typecheck**

Run: `pnpm --filter @atlasjs/audio exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Stage for user commit**

Suggested message: `feat(audio): AudioEngine + Voice (Web Audio graph owner)`

---

### Task 3: `AudioLoader` (fetch + decode → `AudioClip`)

**Files:**
- Create: `packages/audio/src/assets/AudioLoader.ts`
- Test: `packages/audio/test/audio-loader.test.ts`
- Modify: `packages/audio/src/index.ts`

**Interfaces:**
- Consumes: `AssetLoader` from `@atlasjs/assets`; `AudioEngine` (Task 2, for `decode`); `AudioClipAsset`, `AudioClip` (Task 1).
- Produces: `class AudioLoader implements AssetLoader<AudioClipAsset, AudioClip>` — `new AudioLoader(engine: AudioEngine)`; `type: "audio"`; `load(asset: AudioClipAsset): Promise<AudioClip>`.

- [ ] **Step 1: Write the failing test**

`packages/audio/test/audio-loader.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { AudioEngine } from "../src/AudioEngine";
import { AudioClipAsset } from "../src/assets/AudioClipAsset";
import { AudioLoader } from "../src/assets/AudioLoader";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AudioLoader", () => {
  it("fetches the source, decodes it, and returns an AudioClip", async () => {
    const buffer: AudioBuffer = { duration: 2 } as AudioBuffer;
    const engine = {
      decode: vi.fn(async (_data: ArrayBuffer) => buffer),
    } as unknown as AudioEngine;
    const fetchMock = vi.fn(async () => ({
      arrayBuffer: async (): Promise<ArrayBuffer> => new ArrayBuffer(8),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const loader: AudioLoader = new AudioLoader(engine);
    expect(loader.type).toBe("audio");

    const clip = await loader.load(new AudioClipAsset("sfx/hit.wav"));

    expect(fetchMock).toHaveBeenCalledWith("sfx/hit.wav");
    expect(clip.id).toBe("audio:sfx/hit.wav");
    expect(clip.buffer).toBe(buffer);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @atlasjs/audio test audio-loader`
Expected: FAIL — cannot resolve `../src/assets/AudioLoader`.

- [ ] **Step 3: Implement `AudioLoader`**

`packages/audio/src/assets/AudioLoader.ts`:
```ts
import { AssetLoader } from "@atlasjs/assets";

import { AudioEngine } from "../AudioEngine";
import { AudioClipAsset } from "./AudioClipAsset";
import { AudioClip } from "./AudioClip";

export class AudioLoader implements AssetLoader<AudioClipAsset, AudioClip> {
  public readonly type: string = "audio";
  private readonly engine: AudioEngine;

  public constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  public async load(asset: AudioClipAsset): Promise<AudioClip> {
    const response: Response = await fetch(asset.source);
    const data: ArrayBuffer = await response.arrayBuffer();
    const buffer: AudioBuffer = await this.engine.decode(data);
    return new AudioClip(asset.id, buffer);
  }
}
```

- [ ] **Step 4: Export it**

Add to `packages/audio/src/index.ts`:
```ts
export * from "./assets/AudioLoader";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @atlasjs/audio test audio-loader`
Expected: PASS.

- [ ] **Step 6: Stage for user commit**

Suggested message: `feat(audio): AudioLoader (fetch + decodeAudioData)`

---

### Task 4: `AUDIO_ENGINE` token + `AudioPlugin` (backend plugin) + build

Provides the `AUDIO_ENGINE` service and registers the loader. ECS-free (mirrors `InputPlugin`). Then builds the package so downstream `@atlasjs/gameplay` can resolve it.

**Files:**
- Create: `packages/audio/src/tokens.ts`
- Create: `packages/audio/src/AudioPlugin.ts`
- Test: `packages/audio/test/audio-plugin.test.ts`
- Modify: `packages/audio/src/index.ts`

**Interfaces:**
- Consumes: `Plugin`, `Engine` from `@atlasjs/core`; `ServiceRegistry`, `ServiceToken` from `@atlasjs/core`; `ASSET_MANAGER`, `AssetManager`, `AssetPlugin` from `@atlasjs/assets`; `AudioEngine` (Task 2), `AudioLoader` (Task 3).
- Produces:
  - `const AUDIO_ENGINE: ServiceToken<AudioEngine>`.
  - `class AudioPlugin extends Plugin` — `new AudioPlugin()`; `requires: [ASSET_MANAGER]`, `provides: [AUDIO_ENGINE]`.

- [ ] **Step 1: Write the failing test** (runs in node — `AudioEngine` guards `window`/`document`)

`packages/audio/test/audio-plugin.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { Engine } from "@atlasjs/core";
import { ASSET_MANAGER, AssetManager, AssetPlugin } from "@atlasjs/assets";

import { AudioPlugin } from "../src/AudioPlugin";
import { AUDIO_ENGINE } from "../src/tokens";
import { AudioEngine } from "../src/AudioEngine";
import { AudioClip } from "../src/assets/AudioClip";
import { AudioClipAsset } from "../src/assets/AudioClipAsset";
import { FakeAudioContext } from "./helpers/fakeAudioContext";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AudioPlugin", () => {
  it("provides AUDIO_ENGINE and registers a working audio loader", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        arrayBuffer: async (): Promise<ArrayBuffer> => new ArrayBuffer(8),
      })),
    );

    const engine: Engine = new Engine({ loop: () => () => {} });
    engine.use(new AssetPlugin()).use(new AudioPlugin());
    await engine.start();

    const audio: AudioEngine = engine.services.get(AUDIO_ENGINE);
    expect(audio).toBeInstanceOf(AudioEngine);

    const manager: AssetManager = engine.services.get(ASSET_MANAGER);
    const clip = await manager.load<AudioClip>(new AudioClipAsset("music.ogg"));
    expect(clip).toBeInstanceOf(AudioClip);
    expect(clip.id).toBe("audio:music.ogg");

    engine.stop();
  });
});
```

> If `new Engine({ loop: … })` complains about a missing `fixedDelta`/`maxSubSteps`, add them (`{ fixedDelta: 0.1, maxSubSteps: 8, loop: () => () => {} }`) — the harness in `packages/gameplay/test/helpers/harness.ts` shows the full options shape.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @atlasjs/audio test audio-plugin`
Expected: FAIL — cannot resolve `../src/AudioPlugin` / `../src/tokens`.

- [ ] **Step 3: Implement the token**

`packages/audio/src/tokens.ts`:
```ts
import { ServiceRegistry, ServiceToken } from "@atlasjs/core";

import { AudioEngine } from "./AudioEngine";

export const AUDIO_ENGINE: ServiceToken<AudioEngine> =
  ServiceRegistry.createToken<AudioEngine>("AUDIO_ENGINE");
```

- [ ] **Step 4: Implement `AudioPlugin`**

`packages/audio/src/AudioPlugin.ts`:
```ts
import { Engine, Plugin } from "@atlasjs/core";
import { createLogger, Logger } from "@atlasjs/utils";
import { ASSET_MANAGER, AssetManager } from "@atlasjs/assets";

import { AUDIO_ENGINE } from "./tokens";
import { AudioEngine } from "./AudioEngine";
import { AudioLoader } from "./assets/AudioLoader";

export class AudioPlugin extends Plugin {
  private readonly logger: Logger;
  private engine: AudioEngine | null;

  public constructor() {
    super("audio-plugin", { requires: [ASSET_MANAGER], provides: [AUDIO_ENGINE] });
    this.logger = createLogger(AudioPlugin.name);
    this.engine = null;
  }

  public async install(engine: Engine): Promise<void> {
    const assets: AssetManager = await engine.services.wait(ASSET_MANAGER);
    const audio: AudioEngine = new AudioEngine();
    this.engine = audio;
    assets.register(new AudioLoader(audio));
    engine.services.provide(AUDIO_ENGINE, audio);
    this.logger.log("Audio plugin installed");
    this.deferred.resolve();
  }

  public uninstall(): void {
    this.engine?.destroy();
    this.engine = null;
  }
}
```

- [ ] **Step 5: Export token + plugin**

Add to `packages/audio/src/index.ts`:
```ts
export * from "./tokens";
export * from "./AudioPlugin";
```

- [ ] **Step 6: Run the full audio test suite**

Run: `pnpm --filter @atlasjs/audio test`
Expected: PASS (assets + engine + loader + plugin).

- [ ] **Step 7: Typecheck + build the package**

Run: `pnpm --filter @atlasjs/audio exec tsc --noEmit`
Expected: no errors.
Run: `pnpm --filter @atlasjs/audio build`
Expected: emits `packages/audio/dist/` (`index.mjs`, `index.d.mts`, …). This is required before Task 5.

- [ ] **Step 8: Stage for user commit**

Suggested message: `feat(audio): AUDIO_ENGINE token + AudioPlugin`

---

### Task 5: `AudioSource` component (in `@atlasjs/gameplay`)

The LEVEL-1 data-pure component. Adds the `@atlasjs/audio` dependency to gameplay.

**Files:**
- Modify: `packages/gameplay/package.json` (add dep)
- Create: `packages/gameplay/src/components/AudioSource.ts`
- Modify: `packages/gameplay/src/components/index.ts`
- Test: `packages/gameplay/test/audio-source.test.ts`

**Interfaces:**
- Consumes: `AudioClip` from `@atlasjs/audio` (Task 1, type only).
- Produces: `class AudioSource` — `new AudioSource(clip?: AudioClip | null, options?: { volume?: number; loop?: boolean; mute?: boolean; playOnAwake?: boolean })`; public fields `clip: AudioClip | null`, `volume: number`, `loop: boolean`, `mute: boolean`, `playOnAwake: boolean`, `command: "none" | "play" | "stop"`, `isPlaying: boolean`; `play(): this`, `stop(): this`.

- [ ] **Step 1: Add the dependency**

In `packages/gameplay/package.json`, add to `dependencies` (keep alphabetical — first entry):
```json
    "@atlasjs/audio": "workspace:*",
```
Then run: `pnpm install`
Expected: links `@atlasjs/audio` into gameplay's `node_modules`.

- [ ] **Step 2: Write the failing test**

`packages/gameplay/test/audio-source.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { AudioClip } from "@atlasjs/audio";

import { AudioSource } from "../src/components/AudioSource";

const clip: AudioClip = new AudioClip("audio:x", { duration: 1 } as AudioBuffer);

describe("AudioSource", () => {
  it("defaults: silent, non-looping, not playing", () => {
    const source: AudioSource = new AudioSource();
    expect(source.clip).toBeNull();
    expect(source.volume).toBe(1);
    expect(source.loop).toBe(false);
    expect(source.mute).toBe(false);
    expect(source.playOnAwake).toBe(false);
    expect(source.command).toBe("none");
    expect(source.isPlaying).toBe(false);
  });

  it("applies constructor options", () => {
    const source: AudioSource = new AudioSource(clip, {
      volume: 0.5,
      loop: true,
      mute: true,
      playOnAwake: true,
    });
    expect(source.clip).toBe(clip);
    expect(source.volume).toBe(0.5);
    expect(source.loop).toBe(true);
    expect(source.mute).toBe(true);
    expect(source.playOnAwake).toBe(true);
  });

  it("play() and stop() set the command and chain", () => {
    const source: AudioSource = new AudioSource(clip);
    expect(source.play()).toBe(source);
    expect(source.command).toBe("play");
    expect(source.stop()).toBe(source);
    expect(source.command).toBe("stop");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay test audio-source`
Expected: FAIL — cannot resolve `../src/components/AudioSource` (or `@atlasjs/audio` if its `dist` was not built in Task 4 Step 7 — build it).

- [ ] **Step 4: Implement `AudioSource`**

`packages/gameplay/src/components/AudioSource.ts`:
```ts
import { AudioClip } from "@atlasjs/audio";

export type AudioSourceCommand = "none" | "play" | "stop";

export interface AudioSourceOptions {
  volume?: number;
  loop?: boolean;
  mute?: boolean;
  playOnAwake?: boolean;
}

export class AudioSource {
  public clip: AudioClip | null;
  public volume: number;
  public loop: boolean;
  public mute: boolean;
  public playOnAwake: boolean;
  public command: AudioSourceCommand;
  public isPlaying: boolean;

  public constructor(clip: AudioClip | null = null, options?: AudioSourceOptions) {
    this.clip = clip;
    this.volume = options?.volume ?? 1;
    this.loop = options?.loop ?? false;
    this.mute = options?.mute ?? false;
    this.playOnAwake = options?.playOnAwake ?? false;
    this.command = "none";
    this.isPlaying = false;
  }

  public play(): this {
    this.command = "play";
    return this;
  }

  public stop(): this {
    this.command = "stop";
    return this;
  }
}
```

- [ ] **Step 5: Export it**

Add to `packages/gameplay/src/components/index.ts` (after `export * from "./Animator";`):
```ts
export * from "./AudioSource";
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @atlasjs/gameplay test audio-source`
Expected: PASS.

- [ ] **Step 7: Stage for user commit**

Suggested message: `feat(gameplay): AudioSource component`

---

### Task 6: `AudioSystem` (reconciliation, in `@atlasjs/gameplay`)

Owns the `AudioSource → AudioVoice` map; each frame consumes commands, pushes live volume/mute, sweeps finished voices.

**Files:**
- Create: `packages/gameplay/src/systems/AudioSystem.ts`
- Modify: `packages/gameplay/src/systems/index.ts`
- Test: `packages/gameplay/test/audio-system.test.ts`

**Interfaces:**
- Consumes: `NexusSystem`, `NexusSystemContext`, `Entity`, `NexusWorld`, `ComponentRegistry` from `@atlasjs/nexus`; `AudioEngine`, `AudioVoice`, `AudioClip` from `@atlasjs/audio`; `AudioSource` (Task 5).
- Produces: `class AudioSystem implements NexusSystem` — `new AudioSystem(engine: AudioEngine)`; `update(context: NexusSystemContext): void`; `release(source: AudioSource): void`.

- [ ] **Step 1: Write the failing test**

`packages/gameplay/test/audio-system.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { NexusWorld, ComponentRegistry, Entity } from "@atlasjs/nexus";
import { AudioClip, AudioEngine, AudioVoice } from "@atlasjs/audio";

import { AudioSource } from "../src/components/AudioSource";
import { AudioSystem } from "../src/systems/AudioSystem";

class FakeVoice implements AudioVoice {
  public finished: boolean = false;
  public applied: Array<[number, boolean]> = [];
  public stopped: boolean = false;
  public apply(volume: number, muted: boolean): void {
    this.applied.push([volume, muted]);
  }
  public stop(): void {
    this.stopped = true;
    this.finished = true;
  }
}

class FakeEngine {
  public voices: FakeVoice[] = [];
  public lastOpts: { loop: boolean; volume: number; mute: boolean } | null = null;
  public createVoice(
    _clip: AudioClip,
    opts: { loop: boolean; volume: number; mute: boolean },
  ): AudioVoice {
    this.lastOpts = opts;
    const voice: FakeVoice = new FakeVoice();
    this.voices.push(voice);
    return voice;
  }
}

const clip: AudioClip = new AudioClip("audio:x", { duration: 1 } as AudioBuffer);

function setup(): {
  world: NexusWorld;
  engine: FakeEngine;
  system: AudioSystem;
  source: AudioSource;
} {
  const world: NexusWorld = new NexusWorld(new ComponentRegistry());
  world.defineComponent(AudioSource);
  const engine: FakeEngine = new FakeEngine();
  const system: AudioSystem = new AudioSystem(engine as unknown as AudioEngine);
  const entity: Entity = world.createEntity();
  world.addComponent(entity, AudioSource, clip, { loop: true, volume: 0.5 });
  const source: AudioSource = world.requireComponent(entity, AudioSource);
  return { world, engine, system, source };
}

describe("AudioSystem", () => {
  it("play command creates a voice with the source's options and marks it playing", () => {
    const { world, engine, system, source } = setup();
    source.play();
    system.update({ world, dt: 0 });
    expect(engine.voices).toHaveLength(1);
    expect(engine.lastOpts).toEqual({ loop: true, volume: 0.5, mute: false });
    expect(source.command).toBe("none");
    expect(source.isPlaying).toBe(true);
  });

  it("skips play when there is no clip", () => {
    const world: NexusWorld = new NexusWorld(new ComponentRegistry());
    world.defineComponent(AudioSource);
    const engine: FakeEngine = new FakeEngine();
    const system: AudioSystem = new AudioSystem(engine as unknown as AudioEngine);
    const entity: Entity = world.createEntity();
    world.addComponent(entity, AudioSource);
    world.requireComponent(entity, AudioSource).play();
    system.update({ world, dt: 0 });
    expect(engine.voices).toHaveLength(0);
  });

  it("pushes live volume and mute to the active voice each frame", () => {
    const { world, engine, system, source } = setup();
    source.play();
    system.update({ world, dt: 0 });
    source.volume = 0.2;
    source.mute = true;
    system.update({ world, dt: 0 });
    expect(engine.voices[0].applied.at(-1)).toEqual([0.2, true]);
  });

  it("stop command stops the voice and clears playing", () => {
    const { world, engine, system, source } = setup();
    source.play();
    system.update({ world, dt: 0 });
    source.stop();
    system.update({ world, dt: 0 });
    expect(engine.voices[0].stopped).toBe(true);
    expect(source.isPlaying).toBe(false);
  });

  it("sweeps a naturally finished voice and clears playing", () => {
    const { world, engine, system, source } = setup();
    source.play();
    system.update({ world, dt: 0 });
    engine.voices[0].finished = true;
    system.update({ world, dt: 0 });
    expect(source.isPlaying).toBe(false);
  });

  it("release stops the voice (used by onRemove)", () => {
    const { world, engine, system, source } = setup();
    source.play();
    system.update({ world, dt: 0 });
    system.release(source);
    expect(engine.voices[0].stopped).toBe(true);
    expect(source.isPlaying).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay test audio-system`
Expected: FAIL — cannot resolve `../src/systems/AudioSystem`.

- [ ] **Step 3: Implement `AudioSystem`**

`packages/gameplay/src/systems/AudioSystem.ts`:
```ts
import { Entity, NexusSystem, NexusSystemContext } from "@atlasjs/nexus";
import { AudioEngine, AudioVoice } from "@atlasjs/audio";

import { AudioSource } from "../components/AudioSource";

export class AudioSystem implements NexusSystem {
  private readonly engine: AudioEngine;
  private readonly voices: Map<AudioSource, AudioVoice>;

  public constructor(engine: AudioEngine) {
    this.engine = engine;
    this.voices = new Map<AudioSource, AudioVoice>();
  }

  public update({ world }: NexusSystemContext): void {
    this.sweepFinished();
    world.query(AudioSource).each((_entity: Entity, source: AudioSource) => {
      this.consumeCommand(source);
      this.pushLiveState(source);
    });
  }

  public release(source: AudioSource): void {
    this.stopVoice(source);
    source.isPlaying = false;
  }

  private consumeCommand(source: AudioSource): void {
    const command: AudioSource["command"] = source.command;
    source.command = "none";

    if (command === "play") {
      this.stopVoice(source);
      if (source.clip === null) {
        source.isPlaying = false;
        return;
      }
      const voice: AudioVoice = this.engine.createVoice(source.clip, {
        loop: source.loop,
        volume: source.volume,
        mute: source.mute,
      });
      this.voices.set(source, voice);
      source.isPlaying = true;
    } else if (command === "stop") {
      this.stopVoice(source);
      source.isPlaying = false;
    }
  }

  private pushLiveState(source: AudioSource): void {
    const voice: AudioVoice | undefined = this.voices.get(source);
    if (voice === undefined) {
      return;
    }
    voice.apply(source.volume, source.mute);
  }

  private sweepFinished(): void {
    for (const [source, voice] of this.voices) {
      if (voice.finished) {
        this.voices.delete(source);
        source.isPlaying = false;
      }
    }
  }

  private stopVoice(source: AudioSource): void {
    const voice: AudioVoice | undefined = this.voices.get(source);
    if (voice === undefined) {
      return;
    }
    voice.stop();
    this.voices.delete(source);
  }
}
```

- [ ] **Step 4: Export it**

Add to `packages/gameplay/src/systems/index.ts` (after `export * from "./AnimatorSystem";`):
```ts
export * from "./AudioSystem";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @atlasjs/gameplay test audio-system`
Expected: PASS (6 cases).

- [ ] **Step 6: Stage for user commit**

Suggested message: `feat(gameplay): AudioSystem (AudioSource ↔ Web Audio voices)`

---

### Task 7: `AudioApi` façade + `GameplayPlugin` wiring + harness update

Wires the component + system into the scheduler, adds the script façade, and updates the shared test harness (now that `GameplayPlugin` requires `AUDIO_ENGINE`).

**Files:**
- Create: `packages/gameplay/src/scripting/services/AudioApi.ts`
- Modify: `packages/gameplay/src/scripting/services/index.ts`
- Modify: `packages/gameplay/src/GameplayPlugin.ts`
- Create: `packages/gameplay/test/helpers/fake-audio.ts`
- Modify: `packages/gameplay/test/helpers/harness.ts`
- Test: `packages/gameplay/test/audio-api.test.ts`
- Test: `packages/gameplay/test/audio-integration.test.ts`

**Interfaces:**
- Consumes: `ScriptService` from `../core`; `AudioEngine`, `AudioClip`, `AUDIO_ENGINE` from `@atlasjs/audio`; `AudioSource` (Task 5), `AudioSystem` (Task 6); `registerSystem` (existing gameplay adapter).
- Produces:
  - `class AudioApi extends ScriptService<AudioEngine>` — `static token = AUDIO_ENGINE`; `playOneShot(clip: AudioClip, volume?: number): void`; `masterVolume: number` (get/set); `muted: boolean` (get/set).
  - `GameplayPlugin` now `requires` `AUDIO_ENGINE` and registers a `"gameplay:audio"` step at `update`/`Late`.
  - `Harness.audio: FakeAudioEngine` — the recording stub exposed to tests.

- [ ] **Step 1: Write the failing `AudioApi` unit test**

`packages/gameplay/test/audio-api.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { ServiceRegistry } from "@atlasjs/core";
import { AudioClip, AudioEngine, AUDIO_ENGINE } from "@atlasjs/audio";

import { AudioApi } from "../src/scripting/services/AudioApi";

class FakeEngine {
  public oneShots: Array<[AudioClip, number | undefined]> = [];
  public masterVolume: number = 1;
  public muted: boolean = false;
  public playOneShot(clip: AudioClip, volume?: number): void {
    this.oneShots.push([clip, volume]);
  }
}

const clip: AudioClip = new AudioClip("audio:x", { duration: 1 } as AudioBuffer);

describe("AudioApi", () => {
  it("delegates playOneShot and volume/mute to the backend service", () => {
    const services: ServiceRegistry = new ServiceRegistry();
    const engine: FakeEngine = new FakeEngine();
    services.provide(AUDIO_ENGINE, engine as unknown as AudioEngine);

    const api: AudioApi = new AudioApi(services);
    api.playOneShot(clip, 0.7);
    expect(engine.oneShots).toEqual([[clip, 0.7]]);

    api.masterVolume = 0.3;
    expect(engine.masterVolume).toBe(0.3);
    api.muted = true;
    expect(engine.muted).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @atlasjs/gameplay test audio-api`
Expected: FAIL — cannot resolve `../src/scripting/services/AudioApi`.

- [ ] **Step 3: Implement `AudioApi`**

`packages/gameplay/src/scripting/services/AudioApi.ts`:
```ts
import { AudioClip, AudioEngine, AUDIO_ENGINE } from "@atlasjs/audio";

import { ScriptService } from "../core";

export class AudioApi extends ScriptService<AudioEngine> {
  public static readonly token = AUDIO_ENGINE;

  public playOneShot(clip: AudioClip, volume?: number): void {
    this.provided.playOneShot(clip, volume);
  }

  public get masterVolume(): number {
    return this.provided.masterVolume;
  }
  public set masterVolume(value: number) {
    this.provided.masterVolume = value;
  }

  public get muted(): boolean {
    return this.provided.muted;
  }
  public set muted(value: boolean) {
    this.provided.muted = value;
  }
}
```

- [ ] **Step 4: Export the façade**

Add to `packages/gameplay/src/scripting/services/index.ts`:
```ts
export * from "./AudioApi";
```

- [ ] **Step 5: Run the `AudioApi` test to verify it passes**

Run: `pnpm --filter @atlasjs/gameplay test audio-api`
Expected: PASS.

- [ ] **Step 6: Wire the component + system into `GameplayPlugin`**

In `packages/gameplay/src/GameplayPlugin.ts`:

6a. Add the audio import (new line after the `@atlasjs/assets` import at line 12):
```ts
import { AUDIO_ENGINE, AudioEngine } from "@atlasjs/audio";
```

6b. Add `AudioSystem` to the `from "./systems"` import list (lines 24-34) and `AudioSource` to the `from "./components"` import list (lines 36-53).

6c. In the constructor (lines 63-66), add `AUDIO_ENGINE` to `requires`:
```ts
    super("gameplay-plugin", {
      requires: [NEXUS, NEBULA_RENDERER, INERTIAL_ENGINE, ASSET_MANAGER, AUDIO_ENGINE],
      provides: [SCRIPT_MANAGER, INSTANTIATOR, CAMERA_MANAGER, SORTING_LAYERS],
    });
```

6d. In `install`, after `const assets: AssetManager = await engine.services.wait(ASSET_MANAGER);` (line 77), resolve the audio engine:
```ts
    const audio: AudioEngine = await engine.services.wait(AUDIO_ENGINE);
```
And alongside the other `new …System(...)` constructions (near line 93), add:
```ts
    const audioSystem: AudioSystem = new AudioSystem(audio);
```

6e. In `defineComponents` (lines 126-144), add to the chain (e.g. after `.defineComponent(Animator)`):
```ts
      .defineComponent(AudioSource)
```

6f. In `install`, after `this.registerCleanup(...)` (line 100) and before `this.registerSteps(...)`, register the audio lifecycle subscriptions:
```ts
    this.unsubscribers.push(
      world.onAdd(AudioSource, (_entity: Entity, source: AudioSource) => {
        if (source.playOnAwake) {
          source.play();
        }
      }),
      world.onRemove(AudioSource, (_entity: Entity, source: AudioSource) => {
        audioSystem.release(source);
      }),
    );
```

6g. Register the system step. Add `audioSystem: AudioSystem` to the `registerSteps(...)` parameter list (lines 212-225) and pass `audioSystem` at the call site (lines 102-115). Inside `registerSteps`, after the animator block (around line 255), add:
```ts
    this.handles.push(
      registerSystem(update, world, audioSystem, {
        name: "gameplay:audio",
        stage: "Late",
      }),
    );
```

- [ ] **Step 7: Add the recording fake audio engine for the harness**

`packages/gameplay/test/helpers/fake-audio.ts`:
```ts
import { AudioClip, AudioVoice } from "@atlasjs/audio";

export class FakeAudioVoice implements AudioVoice {
  public finished: boolean = false;
  public stopped: boolean = false;
  public apply(_volume: number, _muted: boolean): void {}
  public stop(): void {
    this.stopped = true;
    this.finished = true;
  }
}

export class FakeAudioEngine {
  public readonly voices: FakeAudioVoice[] = [];
  public readonly oneShots: Array<[AudioClip, number | undefined]> = [];
  public masterVolume: number = 1;
  public muted: boolean = false;

  public decode(_data: ArrayBuffer): Promise<AudioBuffer> {
    return Promise.resolve({ duration: 1 } as AudioBuffer);
  }
  public playOneShot(clip: AudioClip, volume?: number): void {
    this.oneShots.push([clip, volume]);
  }
  public createVoice(
    _clip: AudioClip,
    _opts: { loop: boolean; volume: number; mute: boolean },
  ): AudioVoice {
    const voice: FakeAudioVoice = new FakeAudioVoice();
    this.voices.push(voice);
    return voice;
  }
  public destroy(): void {}
}
```

- [ ] **Step 8: Update the harness to provide + expose the fake audio engine**

In `packages/gameplay/test/helpers/harness.ts`:

8a. Add imports:
```ts
import { AUDIO_ENGINE, AudioEngine } from "@atlasjs/audio";
import { FakeAudioEngine } from "./fake-audio";
```

8b. Add `audio: FakeAudioEngine;` to the `Harness` interface (after `physics: FakePhysicsWorld;`).

8c. In `createHarness`, before `engine.use(new GameplayPlugin());` (line 60), create and register the fake under the token:
```ts
  const audio: FakeAudioEngine = new FakeAudioEngine();
  engine.use(new Provide("stub-audio", AUDIO_ENGINE, audio as unknown as AudioEngine));
```

8d. Add `audio,` to the returned object (alongside `world, physics, scripts, …`).

- [ ] **Step 9: Write the failing integration test**

`packages/gameplay/test/audio-integration.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";
import { AudioClip } from "@atlasjs/audio";

import { AudioSource } from "../src/components/AudioSource";
import { createHarness, Harness } from "./helpers/harness";

const clip: AudioClip = new AudioClip("audio:x", { duration: 1 } as AudioBuffer);

describe("GameplayPlugin audio wiring", () => {
  it("playOnAwake starts a voice after a frame", async () => {
    const h: Harness = await createHarness();
    const entity: Entity = h.world.createEntity();
    h.world.addComponent(entity, AudioSource, clip, { loop: true, playOnAwake: true });

    h.frame();

    expect(h.audio.voices).toHaveLength(1);
    expect(h.world.requireComponent(entity, AudioSource).isPlaying).toBe(true);
  });

  it("destroying the entity stops its voice (onRemove → release)", async () => {
    const h: Harness = await createHarness();
    const entity: Entity = h.world.createEntity();
    h.world.addComponent(entity, AudioSource, clip, { loop: true, playOnAwake: true });
    h.frame();

    h.world.destroyEntity(entity);

    expect(h.audio.voices[0].stopped).toBe(true);
  });
});
```

> Timing is verified from `NexusWorld`: `addComponent` emits `onAdd` synchronously (so `playOnAwake` sets `command="play"` before the frame; the `Late`-stage `AudioSystem` then creates the voice within that one `h.frame()`), and `destroyEntity` emits `onRemove` synchronously (so `release` runs immediately, no trailing frame needed).

- [ ] **Step 10: Run the new tests**

Run: `pnpm --filter @atlasjs/gameplay test audio-integration`
Expected: PASS once Steps 6-8 are complete (2 cases).

- [ ] **Step 11: Run the FULL gameplay suite (regression) + typecheck**

Run: `pnpm --filter @atlasjs/gameplay test`
Expected: PASS — all pre-existing tests still green (the harness now satisfies `GameplayPlugin`'s new `AUDIO_ENGINE` requirement).
Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit -p tsconfig.test.json`
Expected: no errors.

- [ ] **Step 12: Build gameplay**

Run: `pnpm --filter @atlasjs/gameplay build`
Expected: emits `packages/gameplay/dist/` (needed by the dino-brawl vite app in Task 8).

- [ ] **Step 13: Stage for user commit**

Suggested message: `feat(gameplay): wire audio (AudioApi + AudioSource/AudioSystem in GameplayPlugin)`

---

### Task 8: Wire audio into `apps/dino-brawl` + browser-verify

End-to-end proof in the real app: add `AudioPlugin` to the engine chain and play looping background music via an `AudioSource` entity.

**Files:**
- Modify: `apps/dino-brawl/package.json` (add dep)
- Modify: `apps/dino-brawl/src/app/GameCanvas.tsx` (add `AudioPlugin` to the chain)
- Modify: `apps/dino-brawl/src/game/ArenaScene.ts` (load a clip + spawn a music entity)
- Add: an audio asset file under `apps/dino-brawl/assets/audio/` (a short `.ogg`/`.mp3`/`.wav` the user provides)

**Interfaces:**
- Consumes: `AudioPlugin`, `AudioClipAsset` (values), `AudioClip` (type) from `@atlasjs/audio`; `AudioSource` from `@atlasjs/gameplay`; `ASSET_MANAGER`/`NEXUS` services in the scene.

- [ ] **Step 1: Add the dependency**

In `apps/dino-brawl/package.json`, add to `dependencies` (keep alphabetical — first entry):
```json
    "@atlasjs/audio": "workspace:*",
```
Then run: `pnpm install`

- [ ] **Step 2: Audio asset (already provided)**

A synthesized placeholder track already exists at `apps/dino-brawl/assets/audio/music.wav` (~132 KB, seamless 3s loop). Use it as-is — do not create or download anything. dino-brawl references assets via Vite `@assets/*` imports (see Step 4a), not hardcoded URLs.

- [ ] **Step 3: Register `AudioPlugin` in the engine chain**

In `apps/dino-brawl/src/app/GameCanvas.tsx`:

3a. Add the import (after the `AssetPlugin` import, line 4):
```ts
import { AudioPlugin } from "@atlasjs/audio";
```
3b. Construct it (after `const assetPlugin: AssetPlugin = new AssetPlugin();`, line 33):
```ts
    const audioPlugin: AudioPlugin = new AudioPlugin();
```
3c. Add `.use(audioPlugin)` to the chain (lines 47-53 — order is free, topo-sorted at boot):
```ts
    engine
      .use(assetPlugin)
      .use(audioPlugin)
      .use(inputPlugin)
      .use(inertiaPlugin)
      .use(rendererPlugin)
      .use(nexusPlugin)
      .use(gameplayPlugin);
```

- [ ] **Step 4: Load the clip + spawn a music entity in the scene**

In `apps/dino-brawl/src/game/ArenaScene.ts`:

4a. Add imports at the top. **Vite gotcha (see `docs/gameplay/audio.md` and repo memory):** import type-only symbols with `import type`, value symbols normally. `AudioClip` is used only as a type → `import type`; `AudioClipAsset`, `AudioSource` are used as values → normal import; `NEXUS`/`ASSET_MANAGER` are values, `NexusWorld`/`AssetManager`/`Entity` are types.
```ts
import { NEXUS, type NexusWorld, type Entity } from "@atlasjs/nexus";
import { ASSET_MANAGER, type AssetManager } from "@atlasjs/assets";
import { AudioClipAsset, type AudioClip } from "@atlasjs/audio";
import { AudioSource } from "@atlasjs/gameplay";
```
4b. In `onCreate`, after `spawnCamera(ctx, player);` (line 35), load the clip and create the music entity:
```ts
    const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
    const world: NexusWorld = ctx.services.get(NEXUS);
    const music: AudioClip = await assets.load<AudioClip>(
      new AudioClipAsset("/assets/audio/music.ogg"),
    );
    const musicEntity: Entity = world.createEntity();
    world.addComponent(musicEntity, AudioSource, music, {
      loop: true,
      playOnAwake: true,
      volume: 0.5,
    });
```
> Confirm the asset URL matches how dino-brawl serves `assets/` — check an existing sprite/texture load (e.g. in `spawnWorld`/`MapBuilder`/`ResourcesPath`) for the exact base path convention (`/assets/...` vs a Vite-imported URL) and match it.

- [ ] **Step 5: Typecheck the app**

Run: `pnpm --filter dino-brawl exec tsc -b`
Expected: no **new** errors (note: 4 pre-existing `noUnusedLocals`/`noUnusedParameters` errors in `Player.ts`/`Sword.ts` are known tech-debt, unrelated — see `docs/backlog.md`).

- [ ] **Step 6: Browser-verify** (expected behavior: `docs/gameplay/audio.md` §8)

1. Start the dev server via the **preview tool** (not Bash): `preview_start` with the dino-brawl launch config.
2. Once loaded, **click the canvas** (the autoplay-unlock gesture) — looping music should start.
3. `read_console_messages` — confirm no audio errors; the `AudioPlugin`/`GameplayPlugin` install logs appear.
4. `read_network_requests` — confirm `/assets/audio/music.ogg` returned 200.
5. Optional deeper check via `javascript_tool`: an `AudioContext` exists and its `state` is `"running"` after the click.
6. Capture a screenshot as proof-of-run.

> Per the sandbox notes (repo memory): the WebGPU preview can be slow/flaky and HMR may serve a stale scene — if music doesn't start, restart the dev server before debugging.

- [ ] **Step 7: Stage for user commit**

Suggested message: `feat(dino-brawl): background music via AudioPlugin + AudioSource`

---

## Notes for the implementer

- **Do not** let `@atlasjs/audio` import `@atlasjs/nexus` or `@atlasjs/gameplay` — if you reach for either, the code belongs in the gameplay-side tasks (5-7), not the audio package.
- **Rebuild order matters:** after Task 4, `@atlasjs/audio` `dist` must exist before gameplay (Tasks 5-7) resolves it; after Task 7, `@atlasjs/gameplay` `dist` must exist before the vite app (Task 8) resolves it.
- The `command`/`isPlaying` fields on `AudioSource` are public (LEVEL-1 data component convention, like `SpriteRender`) — scripts read `isPlaying`; the system owns writes. A script reading `isPlaying` in the same `onUpdate` it called `play()` sees the value from the previous frame's reconciliation (documented in the spec §9).
- The `AudioEngine` is injectable (`ctx`, `{ target, doc }`) and guards `window`/`document` so every audio-package test runs in plain node — do not introduce jsdom.
```
