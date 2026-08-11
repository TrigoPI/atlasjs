# Audio V1.1 (variation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un bouton `pitch` appliqué (playbackRate) au système audio, au même niveau que `volume`, plus deux helpers purs (`randomRange`, `pickRandom`) dans `@atlasjs/utils`, pour que l'auteur roule la variation (pitch/volume/clip) depuis son code de jeu.

**Architecture:** Le backend audio reste déterministe (zéro `Math.random`) et n'expose que des boutons appliqués. `pitch` mappe directement sur `AudioBufferSourceNode.playbackRate` (tape-style). Tout le non-déterminisme est isolé dans un module `random` de `@atlasjs/utils`. Le composant `AudioSource` gagne un champ `pitch` (donnée pure, pas de range).

**Tech Stack:** TypeScript, Web Audio API, vitest, tsdown, pnpm workspaces, Vite (dino-brawl).

**Spec:** [`docs/gameplay/audio-variation.md`](gameplay/audio-variation.md).

## Global Constraints

- **Pas de commit automatique.** Chaque tâche se termine par : prettier sur les fichiers `.ts` touchés → `git add` → **STOP**, l'utilisateur review et commit lui-même. Ne jamais lancer `git commit`.
- **Prettier avant staging**, scopé aux fichiers touchés uniquement : `pnpm exec prettier --write <fichiers>`. Ne pas reformater les `docs/*.md`.
- **Rebuild du dist d'un package dont l'API publique change**, avant que ses dépendants (gameplay, dino-brawl) typecheck ou soient servis par Vite : `pnpm --filter @atlasjs/<pkg> build`.
- **Typecheck avec `tsc --noEmit`**, jamais `tsc -b` (émet des artefacts à côté des sources).
- **Aucun commentaire** dans le code (règle projet).
- **Tout typer**, même trivialement (params de fonction, variables, params de classe).
- **Imports Vite (dino-brawl)** : `randomRange`/`pickRandom` sont des **valeurs** (fonctions) → `import { randomRange, pickRandom } from "@atlasjs/utils"` (jamais `import type`). Les symboles purement type restent `import type`.
- `pitch` par défaut = `1`. Guard partout : `Math.max(0, pitch)` (comme `volume`).
- `AudioVoice.apply` passe de `(volume, muted)` à `(volume, muted, pitch)` — signature à 3 args positionnels, `pitch` requis.
- `playOneShot` passe de `(clip, volume?)` à `(clip, params?: PlaybackParams)`.

---

### Task 1: `randomRange` + `pickRandom` dans `@atlasjs/utils` (+ scaffold vitest)

`@atlasjs/utils` n'a aujourd'hui ni dossier `test/` ni `vitest.config.ts` ni script `test`. Cette tâche les crée en plus des helpers.

**Files:**
- Modify: `packages/utils/package.json` (ajouter scripts `test` + `typecheck`)
- Create: `packages/utils/vitest.config.ts`
- Create: `packages/utils/src/random.ts`
- Modify: `packages/utils/src/index.ts` (export du module `random`)
- Test: `packages/utils/test/random.test.ts`

**Interfaces:**
- Produces:
  - `randomRange(min: number, max: number, rng?: () => number): number`
  - `pickRandom<T>(items: readonly T[], rng?: () => number): T`
  - `rng` par défaut `Math.random`.

- [ ] **Step 1: Ajouter les scripts test/typecheck à `packages/utils/package.json`**

Dans le bloc `"scripts"`, après `"dev"` :

```json
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "test": "vitest run",
    "clean": "rimraf dist",
    "typecheck": "tsc --noEmit"
  },
```

- [ ] **Step 2: Créer `packages/utils/vitest.config.ts`**

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

- [ ] **Step 3: Écrire le test qui échoue — `packages/utils/test/random.test.ts`**

```ts
import { describe, expect, it } from "vitest";

import { randomRange, pickRandom } from "../src/random";

describe("randomRange", () => {
  it("returns min when rng yields 0", () => {
    expect(randomRange(2, 8, () => 0)).toBe(2);
  });

  it("approaches max as rng approaches 1", () => {
    expect(randomRange(2, 8, () => 0.9999)).toBeCloseTo(8, 2);
  });

  it("interpolates linearly for a mid rng value", () => {
    expect(randomRange(0, 10, () => 0.5)).toBe(5);
  });

  it("defaults rng to Math.random and stays within [min, max)", () => {
    for (let i = 0; i < 100; i++) {
      const value: number = randomRange(1, 3);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThan(3);
    }
  });
});

describe("pickRandom", () => {
  it("picks the element at floor(rng * length)", () => {
    const items: readonly string[] = ["a", "b", "c", "d"];
    expect(pickRandom(items, () => 0)).toBe("a");
    expect(pickRandom(items, () => 0.5)).toBe("c");
    expect(pickRandom(items, () => 0.9999)).toBe("d");
  });

  it("throws on an empty array", () => {
    expect(() => pickRandom([], () => 0)).toThrow();
  });

  it("defaults rng to Math.random and returns a member of the array", () => {
    const items: readonly number[] = [10, 20, 30];
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(pickRandom(items));
    }
  });
});
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il échoue**

Run: `pnpm --filter @atlasjs/utils test`
Expected: FAIL — `Cannot find module '../src/random'` (le fichier n'existe pas encore).

- [ ] **Step 5: Implémenter `packages/utils/src/random.ts`**

```ts
export function randomRange(
  min: number,
  max: number,
  rng: () => number = Math.random,
): number {
  return min + rng() * (max - min);
}

export function pickRandom<T>(
  items: readonly T[],
  rng: () => number = Math.random,
): T {
  if (items.length === 0) {
    throw new Error("pickRandom: cannot pick from an empty array");
  }
  const index: number = Math.floor(rng() * items.length);
  return items[index];
}
```

- [ ] **Step 6: Exporter le module depuis le barrel — `packages/utils/src/index.ts`**

Ajouter la ligne :

```ts
export * from "./random";
```

- [ ] **Step 7: Lancer les tests — doivent passer**

Run: `pnpm --filter @atlasjs/utils test`
Expected: PASS (7 tests).

- [ ] **Step 8: Typecheck + build du dist (dépendants en aval)**

Run: `pnpm --filter @atlasjs/utils typecheck && pnpm --filter @atlasjs/utils build`
Expected: aucun diagnostic, `dist/` régénéré (contient `random.mjs` + `.d.mts`).

- [ ] **Step 9: Prettier + stage + STOP**

```bash
pnpm exec prettier --write packages/utils/package.json packages/utils/vitest.config.ts packages/utils/src/random.ts packages/utils/src/index.ts packages/utils/test/random.test.ts
git add packages/utils/package.json packages/utils/vitest.config.ts packages/utils/src/random.ts packages/utils/src/index.ts packages/utils/test/random.test.ts
```

Puis **STOP** : présenter à l'utilisateur pour review + commit. Ne pas committer.

---

### Task 2: bouton `pitch` dans le backend `@atlasjs/audio`

**Files:**
- Modify: `packages/audio/src/AudioEngine.ts` (type `PlaybackParams`, `createVoice` + `playOneShot` acceptent `pitch`)
- Modify: `packages/audio/src/AudioVoice.ts` (interface `apply` gagne `pitch`)
- Modify: `packages/audio/src/Voice.ts` (`apply` pose `playbackRate`)
- Modify: `packages/audio/test/helpers/fakeAudioContext.ts` (`FakeBufferSourceNode.playbackRate`)
- Test: `packages/audio/test/audio-engine.test.ts` (nouveaux cas + MAJ des signatures existantes)

**Interfaces:**
- Consumes: rien de Task 1.
- Produces:
  - `export interface PlaybackParams { volume?: number; pitch?: number }` (dans `AudioEngine.ts`, ré-exporté par `index.ts` via `export * from "./AudioEngine"`).
  - `AudioEngine.playOneShot(clip: AudioClip, params?: PlaybackParams): void`
  - `AudioEngine.createVoice(clip, opts: { loop: boolean; volume: number; mute: boolean; pitch?: number }): AudioVoice`
  - `AudioVoice.apply(volume: number, muted: boolean, pitch: number): void`

- [ ] **Step 1: Ajouter `playbackRate` au fake buffer source — `packages/audio/test/helpers/fakeAudioContext.ts`**

Dans `FakeBufferSourceNode`, après `public loop: boolean = false;` :

```ts
  public playbackRate: { value: number } = { value: 1 };
```

- [ ] **Step 2: Écrire les tests qui échouent — `packages/audio/test/audio-engine.test.ts`**

Mettre à jour les cas existants qui utilisent les anciennes signatures :

Dans `"playOneShot wires a source through a gain into master and starts it"`, remplacer `engine.playOneShot(clip, 0.5);` par :

```ts
    engine.playOneShot(clip, { volume: 0.5 });
```

Dans `"createVoice returns a live handle whose apply and stop drive the nodes"`, remplacer les deux `voice.apply(0.2, false)` / `voice.apply(0.2, true)` par :

```ts
    voice.apply(0.2, false, 1);
```
```ts
    voice.apply(0.2, true, 1);
```

Puis ajouter ces nouveaux cas dans le `describe("AudioEngine", ...)` :

```ts
  it("playOneShot applies pitch to the source playbackRate", () => {
    const { engine, ctx } = make();
    engine.playOneShot(clip, { volume: 1, pitch: 1.5 });
    expect(ctx.sources[0].playbackRate.value).toBeCloseTo(1.5);
    engine.destroy();
  });

  it("playOneShot defaults pitch to 1", () => {
    const { engine, ctx } = make();
    engine.playOneShot(clip);
    expect(ctx.sources[0].playbackRate.value).toBe(1);
    engine.destroy();
  });

  it("createVoice sets the initial playbackRate from pitch", () => {
    const { engine, ctx } = make();
    engine.createVoice(clip, { loop: false, volume: 1, mute: false, pitch: 0.5 });
    expect(ctx.sources[0].playbackRate.value).toBeCloseTo(0.5);
    engine.destroy();
  });

  it("apply updates playbackRate live and clamps negatives to 0", () => {
    const { engine, ctx } = make();
    const voice = engine.createVoice(clip, { loop: true, volume: 1, mute: false });
    expect(ctx.sources[0].playbackRate.value).toBe(1);
    voice.apply(1, false, 2);
    expect(ctx.sources[0].playbackRate.value).toBeCloseTo(2);
    voice.apply(1, false, -3);
    expect(ctx.sources[0].playbackRate.value).toBe(0);
    engine.destroy();
  });
```

- [ ] **Step 3: Lancer les tests pour vérifier qu'ils échouent**

Run: `pnpm --filter @atlasjs/audio test`
Expected: FAIL — erreurs de type / d'exécution sur `apply` à 3 args, `playOneShot` objet, `playbackRate` non posé.

- [ ] **Step 4: Étendre l'interface — `packages/audio/src/AudioVoice.ts`**

```ts
export interface AudioVoice {
  readonly finished: boolean;
  apply(volume: number, muted: boolean, pitch: number): void;
  stop(): void;
}
```

- [ ] **Step 5: Implémenter le pitch live — `packages/audio/src/Voice.ts`**

Remplacer la méthode `apply` :

```ts
  public apply(volume: number, muted: boolean, pitch: number): void {
    this.gain.gain.value = muted ? 0 : Math.max(0, volume);
    this.source.playbackRate.value = Math.max(0, pitch);
  }
```

- [ ] **Step 6: `PlaybackParams` + `pitch` dans `AudioEngine` — `packages/audio/src/AudioEngine.ts`**

Ajouter le type près du haut du fichier (après les `import`, avant `GESTURE_EVENTS`) :

```ts
export interface PlaybackParams {
  volume?: number;
  pitch?: number;
}
```

Remplacer `playOneShot` :

```ts
  public playOneShot(clip: AudioClip, params: PlaybackParams = {}): void {
    const source: AudioBufferSourceNode = this.ctx.createBufferSource();
    source.buffer = clip.buffer;
    source.playbackRate.value = Math.max(0, params.pitch ?? 1);
    const gain: GainNode = this.ctx.createGain();
    gain.gain.value = Math.max(0, params.volume ?? 1);
    source.connect(gain);
    gain.connect(this.master);
    source.onended = (): void => {
      source.disconnect();
      gain.disconnect();
    };

    source.start();
  }
```

Remplacer la signature + le corps de `createVoice` (ajouter `pitch?` aux opts et poser `playbackRate`) :

```ts
  public createVoice(
    clip: AudioClip,
    opts: { loop: boolean; volume: number; mute: boolean; pitch?: number },
  ): AudioVoice {
    const source: AudioBufferSourceNode = this.ctx.createBufferSource();
    source.buffer = clip.buffer;
    source.loop = opts.loop;
    source.playbackRate.value = Math.max(0, opts.pitch ?? 1);
    const gain: GainNode = this.ctx.createGain();
    gain.gain.value = opts.mute ? 0 : Math.max(0, opts.volume);
    source.connect(gain);
    gain.connect(this.master);
    const voice: Voice = new Voice(source, gain);
    source.start();
    return voice;
  }
```

- [ ] **Step 7: Lancer les tests — doivent passer**

Run: `pnpm --filter @atlasjs/audio test`
Expected: PASS (tous les cas, dont les 4 nouveaux).

- [ ] **Step 8: Typecheck + build du dist**

Run: `pnpm --filter @atlasjs/audio typecheck && pnpm --filter @atlasjs/audio build`
Expected: aucun diagnostic, `dist/` régénéré (exporte `PlaybackParams`, nouvelle signature `apply`).

- [ ] **Step 9: Prettier + stage + STOP**

```bash
pnpm exec prettier --write packages/audio/src/AudioEngine.ts packages/audio/src/AudioVoice.ts packages/audio/src/Voice.ts packages/audio/test/helpers/fakeAudioContext.ts packages/audio/test/audio-engine.test.ts
git add packages/audio/src/AudioEngine.ts packages/audio/src/AudioVoice.ts packages/audio/src/Voice.ts packages/audio/test/helpers/fakeAudioContext.ts packages/audio/test/audio-engine.test.ts
```

Puis **STOP** : review + commit par l'utilisateur.

---

### Task 3: `AudioSource.pitch` + propagation `AudioSystem` + `AudioApi` dans `@atlasjs/gameplay`

**Files:**
- Modify: `packages/gameplay/src/components/AudioSource.ts` (champ `pitch` + option)
- Modify: `packages/gameplay/src/systems/AudioSystem.ts` (passe `pitch` à `createVoice` + `apply`)
- Modify: `packages/gameplay/src/scripting/services/AudioApi.ts` (`playOneShot` → `PlaybackParams`)
- Modify: `packages/gameplay/test/helpers/fake-audio.ts` (signatures `apply`/`createVoice`/`playOneShot`)
- Test: `packages/gameplay/test/audio-source.test.ts` (défaut + option `pitch`)
- Test: `packages/gameplay/test/audio-system.test.ts` (MAJ fakes locaux + propagation `pitch`)

**Interfaces:**
- Consumes (Task 2): `PlaybackParams`, `createVoice(..., { ..., pitch? })`, `apply(volume, muted, pitch)`.
- Produces:
  - `AudioSource.pitch: number` (défaut `1`), `AudioSourceOptions.pitch?: number`.

- [ ] **Step 1: Écrire les tests `AudioSource` qui échouent — `packages/gameplay/test/audio-source.test.ts`**

Dans le cas `"defaults: silent, non-looping, not playing"`, ajouter après `expect(source.volume).toBe(1);` :

```ts
    expect(source.pitch).toBe(1);
```

Dans le cas `"applies constructor options"`, ajouter `pitch` aux options et à l'assertion :

```ts
    const source: AudioSource = new AudioSource(clip, {
      volume: 0.5,
      loop: true,
      mute: true,
      playOnAwake: true,
      pitch: 1.25,
    });
```
```ts
    expect(source.pitch).toBe(1.25);
```

- [ ] **Step 2: Écrire les tests `AudioSystem` qui échouent — `packages/gameplay/test/audio-system.test.ts`**

Mettre à jour le fake local `FakeVoice.apply` pour enregistrer le pitch :

```ts
class FakeVoice implements AudioVoice {
  public finished: boolean = false;
  public applied: Array<[number, boolean, number]> = [];
  public stopped: boolean = false;
  public apply(volume: number, muted: boolean, pitch: number): void {
    this.applied.push([volume, muted, pitch]);
  }
  public stop(): void {
    this.stopped = true;
    this.finished = true;
  }
}
```

Mettre à jour le fake local `FakeEngine.createVoice` pour accepter `pitch` :

```ts
class FakeEngine {
  public voices: FakeVoice[] = [];
  public lastOpts: {
    loop: boolean;
    volume: number;
    mute: boolean;
    pitch?: number;
  } | null = null;
  public createVoice(
    _clip: AudioClip,
    opts: { loop: boolean; volume: number; mute: boolean; pitch?: number },
  ): AudioVoice {
    this.lastOpts = opts;
    const voice: FakeVoice = new FakeVoice();
    this.voices.push(voice);
    return voice;
  }
}
```

Mettre à jour les assertions existantes impactées :

Dans `"play command creates a voice with the source's options and marks it playing"` :

```ts
    expect(engine.lastOpts).toEqual({
      loop: true,
      volume: 0.5,
      mute: false,
      pitch: 1,
    });
```

Dans `"pushes live volume and mute to the active voice each frame"` :

```ts
    expect(engine.voices[0].applied.at(-1)).toEqual([0.2, true, 1]);
```

Ajouter un nouveau cas dédié au pitch :

```ts
  it("passes the source pitch to createVoice and pushes it live", () => {
    const { world, engine, system, source } = setup();
    source.pitch = 1.5;
    source.play();
    system.update({ world, dt: 0 });
    expect(engine.lastOpts?.pitch).toBe(1.5);
    source.pitch = 0.75;
    system.update({ world, dt: 0 });
    expect(engine.voices[0].applied.at(-1)).toEqual([0.5, false, 0.75]);
  });
```

- [ ] **Step 3: Lancer les tests pour vérifier qu'ils échouent**

Run: `pnpm --filter @atlasjs/gameplay test`
Expected: FAIL — `source.pitch` inexistant, `lastOpts` sans `pitch`, `applied` en 2-uplets.

- [ ] **Step 4: Ajouter `pitch` au composant — `packages/gameplay/src/components/AudioSource.ts`**

Ajouter `pitch` à l'interface d'options :

```ts
export interface AudioSourceOptions {
  volume?: number;
  loop?: boolean;
  mute?: boolean;
  playOnAwake?: boolean;
  pitch?: number;
}
```

Ajouter le champ + son init (après `volume`) :

```ts
  public volume: number;
  public pitch: number;
```
```ts
    this.volume = options?.volume ?? 1;
    this.pitch = options?.pitch ?? 1;
```

- [ ] **Step 5: Propager `pitch` — `packages/gameplay/src/systems/AudioSystem.ts`**

Dans `consumeCommand`, passer `pitch` à `createVoice` :

```ts
      const voice: AudioVoice = this.engine.createVoice(source.clip, {
        loop: source.loop,
        volume: source.volume,
        mute: source.mute,
        pitch: source.pitch,
      });
```

Dans `pushLiveState`, passer `pitch` à `apply` :

```ts
    voice.apply(source.volume, source.mute, source.pitch);
```

- [ ] **Step 6: Forward `PlaybackParams` — `packages/gameplay/src/scripting/services/AudioApi.ts`**

```ts
import {
  AudioClip,
  AudioEngine,
  AUDIO_ENGINE,
  PlaybackParams,
} from "@atlasjs/audio";

import { ScriptService } from "../core";

export class AudioApi extends ScriptService<AudioEngine> {
  public static readonly token = AUDIO_ENGINE;

  public playOneShot(clip: AudioClip, params?: PlaybackParams): void {
    this.provided.playOneShot(clip, params);
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

- [ ] **Step 7: MAJ du fake partagé — `packages/gameplay/test/helpers/fake-audio.ts`**

```ts
import { AudioClip, AudioVoice, PlaybackParams } from "@atlasjs/audio";

export class FakeAudioVoice implements AudioVoice {
  public finished: boolean = false;
  public stopped: boolean = false;
  public apply(_volume: number, _muted: boolean, _pitch: number): void {}
  public stop(): void {
    this.stopped = true;
    this.finished = true;
  }
}

export class FakeAudioEngine {
  public readonly voices: FakeAudioVoice[] = [];
  public readonly oneShots: Array<[AudioClip, PlaybackParams | undefined]> = [];
  public masterVolume: number = 1;
  public muted: boolean = false;

  public decode(_data: ArrayBuffer): Promise<AudioBuffer> {
    return Promise.resolve({ duration: 1 } as AudioBuffer);
  }
  public playOneShot(clip: AudioClip, params?: PlaybackParams): void {
    this.oneShots.push([clip, params]);
  }
  public createVoice(
    _clip: AudioClip,
    _opts: { loop: boolean; volume: number; mute: boolean; pitch?: number },
  ): AudioVoice {
    const voice: FakeAudioVoice = new FakeAudioVoice();
    this.voices.push(voice);
    return voice;
  }
  public destroy(): void {}
}
```

- [ ] **Step 8: Lancer les tests — doivent passer**

Run: `pnpm --filter @atlasjs/gameplay test`
Expected: PASS (suite gameplay complète, dont le nouveau cas pitch). Si `determinism.test.ts` casse sur la signature `apply`/`createVoice` de son stub inline (`createVoice: () => ({ finished: false, apply: () => {}, stop: () => {} })`), c'est compatible (arité laxiste tolérée par TS pour un callback) — ne pas y toucher sauf erreur réelle ; dans ce cas, aligner son `apply` sur `(v, m, p) => {}`.

- [ ] **Step 9: Typecheck + build du dist**

Run: `pnpm --filter @atlasjs/gameplay typecheck && pnpm --filter @atlasjs/gameplay build`
Expected: aucun diagnostic, `dist/` régénéré.

- [ ] **Step 10: Prettier + stage + STOP**

```bash
pnpm exec prettier --write packages/gameplay/src/components/AudioSource.ts packages/gameplay/src/systems/AudioSystem.ts packages/gameplay/src/scripting/services/AudioApi.ts packages/gameplay/test/helpers/fake-audio.ts packages/gameplay/test/audio-source.test.ts packages/gameplay/test/audio-system.test.ts
git add packages/gameplay/src/components/AudioSource.ts packages/gameplay/src/systems/AudioSystem.ts packages/gameplay/src/scripting/services/AudioApi.ts packages/gameplay/test/helpers/fake-audio.ts packages/gameplay/test/audio-source.test.ts packages/gameplay/test/audio-system.test.ts
```

Puis **STOP** : review + commit par l'utilisateur.

---

### Task 4: câbler la variation dans `apps/dino-brawl` + browser-verify

Démo + preuve. `@atlasjs/utils` est **déjà** dépendance de dino-brawl (aucun changement `package.json`). Le repo n'a qu'un fichier `grass.mp3` → la variation **audible** repose sur pitch + volume ; `pickRandom` est câblé sur le(s) clip(s) disponible(s) et déjà couvert par les tests unitaires.

**Files:**
- Modify: `apps/dino-brawl/src/game/spawn/spawnPlayer.ts` (prefab `runningAudioPlayer` : `randomRange` pitch/volume + `pickRandom` clip)

**Interfaces:**
- Consumes: `randomRange`, `pickRandom` (`@atlasjs/utils`), `AudioSource.pitch` (`@atlasjs/gameplay`).

- [ ] **Step 1: Importer les helpers — `apps/dino-brawl/src/game/spawn/spawnPlayer.ts`**

Ajouter l'import (valeurs, pas `import type`) près des autres imports `@atlasjs/*` :

```ts
import { randomRange, pickRandom } from "@atlasjs/utils";
```

- [ ] **Step 2: Utiliser la variation dans le prefab `runningAudioPlayer`**

Remplacer le corps du `build` (actuellement `audio.volume = Math.random() * 0.05 + 0.05; console.log(...)`) par :

```ts
  const runningAudioPlayer: Prefab = definePrefab({
    name: "runningAudioPlayer",
    build: (entity: EntityBuilder): void => {
      const audio: AudioSource = entity.add(AudioSource, pickRandom([grassSound]), {
        playOnAwake: true,
      });

      audio.volume = randomRange(0.05, 0.1);
      audio.pitch = randomRange(0.9, 1.1);
    },
  });
```

> Note : `pickRandom([grassSound])` documente le point d'extension (l'auteur ajoutera `grass02..04` plus tard) ; avec un seul clip il retourne toujours `grassSound`. La variation audible vient de `pitch` + `volume`. Le `console.log` de debug est retiré.

Vérifier que `AudioSource` type l'annotation : `AudioSource` est déjà importé depuis `@atlasjs/gameplay` en tête de fichier.

- [ ] **Step 3: Typecheck de l'app**

Run: `pnpm --filter dino-brawl exec tsc --noEmit`
Expected: pas de nouvelle erreur liée à l'audio (des erreurs `noUnusedLocals` pré-existantes dans `Player.ts`/`Sword.ts` sont connues et hors-scope — cf. backlog « Dette technique »).

- [ ] **Step 4: Browser-verify (proof)**

Suivre le workflow preview (dev server dino-brawl). Rappels sandbox : la pane WebGPU est lente/flaky et le HMR peut servir une scène périmée → **redémarrer le dev server** plutôt que se fier au HMR.

1. `preview_start` avec le dev server de dino-brawl (nom depuis `.claude/launch.json`).
2. Cliquer dans le canvas (débloque l'`AudioContext`), déplacer le dino (touches de `dinoControls`) quelques secondes pour déclencher des foulées.
3. `read_console_messages` : aucune erreur ; l'`AudioContext` passe `running` (comme la vérif v1).
4. Preuve de variation : instrumenter temporairement (ou via un stash `window.__pitches`) pour confirmer que les `AudioSource` de foulée reçoivent des `pitch`/`volume` variés entre pas — OU inspecter que des sources démarrent avec des `playbackRate` différents. Retirer toute instrumentation temporaire avant de figer.
5. `computer {action: "screenshot"}` du jeu en marche pour la trace visuelle (l'audibilité réelle reste à confirmer à l'oreille par l'utilisateur — le dire explicitement).

- [ ] **Step 5: Prettier + stage + STOP**

```bash
pnpm exec prettier --write apps/dino-brawl/src/game/spawn/spawnPlayer.ts
git add apps/dino-brawl/src/game/spawn/spawnPlayer.ts
```

Puis **STOP** : review + commit par l'utilisateur. Signaler que l'audibilité (pas plus vivants) est à valider à l'oreille.

---

## Notes for the implementer

- **Ordre des tâches impératif** : 1 → 2 → 3 → 4. Task 3 consomme les types/signatures de Task 2 (`PlaybackParams`, `apply` à 3 args) ; Task 4 consomme Task 1 + Task 3. Rebuild le `dist` d'un package modifié avant de typechecker/servir ses dépendants (déjà inclus en fin de Task 1/2/3).
- **Pas de commit auto** : chaque tâche s'arrête sur un `git add` ; l'utilisateur review et commit. Re-tester sur l'état committé si besoin (l'utilisateur peut ajuster au commit).
- **`grass.mp3` unique** : ne pas fabriquer de faux assets audio. Si l'utilisateur fournit `grass02..04`, remplacer `[grassSound]` par le tableau des clips chargés.
- **Sémantique pitch** : tape-style (hauteur + vitesse couplées). Aucun découplage pitch/vitesse (hors-scope).
- **Rien de spatial / pan / fade / bus** : hors périmètre V1.1 (backlog V2).
