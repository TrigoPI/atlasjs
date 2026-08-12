# Dino-Brawl — Spawn → Prefab + SpriteSheets centralisées + cleanup — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centraliser les spritesheets de `apps/dino-brawl` comme les assets le sont déjà, brancher les prefabs (toute la construction d'entités passe en `prefabs/`), amincir `spawnPlayer`, et nettoyer les scories — sans changement de comportement à l'écran.

**Architecture:** Un module `sheets/` qui calque `loaders/` (`SheetList` de descripteurs nommés → `SheetLoader` construisant un registre clé par nom logique). Les `SpriteAnimation` étant *stateful* et non clonées par l'`Animator`, les consommateurs reçoivent un **thunk** `createClips: () => Record<string, SpriteAnimation>` (rejoué à chaque appel = clips frais par instance), jamais un record figé. `spawnPlayer` devient un orchestrateur mince qui instancie `PlayerPrefab`/`ShadowPrefab` via l'`Instantiator` et câble les prefabs runtime (particule/audio, construits par des factories qui capturent leurs deps) dans les scripts.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`), Vite 7, Turborepo/pnpm, AtlasJS (`@atlasjs/gameplay`, `@atlasjs/nexus`, `@atlasjs/nebula`, `@atlasjs/audio`, `@atlasjs/utils`, `@atlasjs/math`).

**Spec source:** [`docs/2026-08-12-dino-brawl-spawn-prefab-sheet-cleanup-design.md`](2026-08-12-dino-brawl-spawn-prefab-sheet-cleanup-design.md).

## Global Constraints

- **Zéro changement de comportement à l'écran.** Refactor structurel : dino animé (idle/run/sprint), ombre parentée semi-transparente, particules de course qui spawn et s'auto-détruisent, son grass. Tout doit rester identique.
- **Scope strictement `apps/dino-brawl`.** Aucun changement dans `packages/@atlasjs/*`.
- **Ne PAS toucher** `spawn/spawnWorld.ts` ni `spawn/spawnCamera.ts` ni `loaders/ResourcesPath.ts` (ce dernier reste : consommé par `spawnWorld`/`spawnSword`).
- **Toujours typer** (params, variables, champs) — règle `CLAUDE.md`. Type de retour explicite sur toute fonction non triviale.
- **`import type` obligatoire** pour tout symbole *type-only* (`verbatimModuleSyntax: true`). Un import *valeur* d'un symbole type-only compile sous tsc mais casse Vite au runtime (écran noir). En particulier : `SpriteAnimation`, `AudioClip`, `Vec2`, `SceneContext`, `AssetsLoader`, `SheetLoader`, `Prefab`, `Instantiator`, `EntityBuilder`, `Sprite` (utilisés uniquement comme types) → `import type`. Inversement `Animator`, `AudioSource`, `SpriteRenderer`, `Transform2D`, `RigidBody`, `Collider2D`, `CharacterController2D`, `PlayerInput`, `Color`, `definePrefab`, `SpriteSheet`, `SpriteAnimation` (quand `new`), `INSTANTIATOR`, `SCRIPT_MANAGER`, `NEXUS`, `pickRandom`, `randomRange` → import **valeur**.
- **Pas de commentaires** dans le code (règle `CLAUDE.md`).
- **Pas de commit automatique.** Chaque tâche se termine par : prettier (scopé aux fichiers touchés) + `git add` des fichiers, puis **handoff à l'utilisateur** qui review et commit lui-même (règle `CLAUDE.md` superpowers + cadence d'exécution). Un message de commit suggéré est fourni ; ne PAS l'exécuter.
- **Toutes les commandes se lancent depuis la racine du repo** (`/Users/AlexisEnSah/Desktop/Node/atlas`).
- **Prettier scopé** : `pnpm exec prettier --write <fichiers .ts touchés>`. Ne jamais reformater `docs/*.md` (non maintenus par prettier).

## Protocole de vérification navigateur (référencé par la Task 4)

Le pane WebGPU sert des scènes *stales* sous HMR → **redémarrer le dev server, pas de HMR**.

1. `preview_start` avec `{ name: "dino-brawl" }`. Si un serveur tourne déjà : `preview_stop` puis `preview_start`.
2. `read_console_messages` (aucune erreur) + `read_page` (structure).
3. `computer { action: "screenshot" }` pour la preuve visuelle.
4. Vérifier : dino visible + animé, ombre semi-transparente sous le dino, WASD déplace, particules de course apparaissent puis disparaissent en courant, pas d'erreur console.

## File Structure

- `src/game/sheets/sheets/sheets.types.ts` — types (`SheetBuilder`, `ClipBuilder`, **+ `SheetDescriptor`**).
- `src/game/sheets/sheets/DinoSheet.ts` — def dino (fix `columns: 24`).
- `src/game/sheets/sheets/RunningParticleSheet.ts` — **nouveau** : def particule.
- `src/game/sheets/sheets/index.ts` — barrel des defs.
- `src/game/sheets/SheetList.ts` — **nouveau** : descripteurs nommés.
- `src/game/sheets/SheetLoader.ts` — **réécrit** : registre par nom + `createClips`.
- `src/game/sheets/index.ts` — barrel.
- `src/game/prefabs/PlayerPrefab.ts` — **modifié** : + `Animator`, `SpriteRenderer`, prop `createClips`.
- `src/game/prefabs/ShadowPrefab.ts` — **modifié** : aligné sur l'ombre inline (offset local, alpha).
- `src/game/prefabs/RunningParticlePrefab.ts` — **réécrit** : factory `createRunningParticlePrefab`.
- `src/game/prefabs/RunningAudioPrefab.ts` — **nouveau** : factory `createRunningAudioPrefab`.
- `src/game/prefabs/index.ts` — barrel.
- `src/game/spawn/spawnPlayer.ts` — **aminci** : orchestrateur via `Instantiator`.
- `src/game/ArenaScene.ts` — **modifié** : câble `SheetLoader`, passe à `spawnPlayer`.

---

## Task 1 : Module `sheets/` centralisé (mirror de `loaders/`)

**Files:**
- Modify: `apps/dino-brawl/src/game/sheets/sheets/sheets.types.ts`
- Modify: `apps/dino-brawl/src/game/sheets/sheets/DinoSheet.ts`
- Create: `apps/dino-brawl/src/game/sheets/sheets/RunningParticleSheet.ts`
- Modify: `apps/dino-brawl/src/game/sheets/sheets/index.ts`
- Create: `apps/dino-brawl/src/game/sheets/SheetList.ts`
- Modify (rewrite): `apps/dino-brawl/src/game/sheets/SheetLoader.ts`
- Modify: `apps/dino-brawl/src/game/sheets/index.ts`

**Interfaces:**
- Consumes: `AssetsLoader.getAsset<Texture2D>(name)` (déjà existant), `SpriteSheet.fromAutoGrid`, `SpriteAnimation`, `getManyInRange`.
- Produces (signatures exactes, consommées par Task 3) :
  - `type SheetDescriptor = { name: string; texture: string; sheet: SheetBuilder; clips: ClipBuilder }`
  - `const SheetList: SheetDescriptor[]`
  - `class SheetLoader { constructor(assetsLoader: AssetsLoader); addSheet(descriptor: SheetDescriptor): SheetLoader; build(): void; createClips(name: string): Record<string, SpriteAnimation> }`
  - Noms logiques : `"sheet:dino"`, `"sheet:running_particle"`.

- [ ] **Step 1 : Ajouter `SheetDescriptor` aux types**

Remplacer le contenu de `apps/dino-brawl/src/game/sheets/sheets/sheets.types.ts` par :

```ts
import type { SpriteAnimation, SpriteSheet, Texture2D } from "@atlasjs/nebula";

export type SheetBuilder = (texture: Texture2D) => SpriteSheet;

export type ClipBuilder = (
  sheet: SpriteSheet,
) => Record<string, SpriteAnimation>;

export type SheetDescriptor = {
  name: string;
  texture: string;
  sheet: SheetBuilder;
  clips: ClipBuilder;
};
```

- [ ] **Step 2 : Corriger `DinoSheet` (`columns: 24`)**

Dans `apps/dino-brawl/src/game/sheets/sheets/DinoSheet.ts`, dans `DinoSheetBuilder`, remplacer `columns: 4,` par `columns: 24,`. Ne rien changer d'autre (les `DinoClips` idle/run/pre_sprint/sprint sont déjà identiques à l'inline).

- [ ] **Step 3 : Créer `RunningParticleSheet.ts`**

Créer `apps/dino-brawl/src/game/sheets/sheets/RunningParticleSheet.ts` :

```ts
import { Vec2 } from "@atlasjs/math";
import { SpriteAnimation, SpriteSheet, type Texture2D } from "@atlasjs/nebula";

import type { ClipBuilder, SheetBuilder } from "./sheets.types";

export const RunningParticleSheetBuilder: SheetBuilder = (
  texture: Texture2D,
): SpriteSheet =>
  SpriteSheet.fromAutoGrid({
    texture,
    name: "running_particle",
    rows: 1,
    columns: 8,
    pivot: new Vec2(0.5, 1),
  });

export const RunningParticleClips: ClipBuilder = (
  sheet: SpriteSheet,
): Record<string, SpriteAnimation> => ({
  default: new SpriteAnimation({
    frames: sheet.getManyInRange("running_particle_", 0, 7),
    fps: 15,
    loop: false,
    autoPlay: true,
  }),
});
```

- [ ] **Step 4 : Barrel des defs**

Remplacer le contenu de `apps/dino-brawl/src/game/sheets/sheets/index.ts` par :

```ts
export * from "./DinoSheet";
export * from "./RunningParticleSheet";
export * from "./sheets.types";
```

- [ ] **Step 5 : Créer `SheetList.ts`**

Créer `apps/dino-brawl/src/game/sheets/SheetList.ts` :

```ts
import { DinoClips, DinoSheetBuilder } from "./sheets/DinoSheet";
import {
  RunningParticleClips,
  RunningParticleSheetBuilder,
} from "./sheets/RunningParticleSheet";
import type { SheetDescriptor } from "./sheets/sheets.types";

export const SheetList: SheetDescriptor[] = [
  {
    name: "sheet:dino",
    texture: "texture:yellow_dino",
    sheet: DinoSheetBuilder,
    clips: DinoClips,
  },
  {
    name: "sheet:running_particle",
    texture: "texture:running_particle",
    sheet: RunningParticleSheetBuilder,
    clips: RunningParticleClips,
  },
];
```

- [ ] **Step 6 : Réécrire `SheetLoader.ts`**

Remplacer intégralement `apps/dino-brawl/src/game/sheets/SheetLoader.ts` par :

```ts
import type { SpriteAnimation, SpriteSheet, Texture2D } from "@atlasjs/nebula";

import type { AssetsLoader } from "../loaders";
import type { ClipBuilder, SheetDescriptor } from "./sheets/sheets.types";

type SheetEntry = {
  sheet: SpriteSheet;
  clips: ClipBuilder;
};

export class SheetLoader {
  private readonly assetsLoader: AssetsLoader;
  private readonly descriptors: SheetDescriptor[];
  private readonly registry: Record<string, SheetEntry>;

  public constructor(assetsLoader: AssetsLoader) {
    this.assetsLoader = assetsLoader;
    this.descriptors = [];
    this.registry = {};
  }

  public addSheet(descriptor: SheetDescriptor): SheetLoader {
    this.descriptors.push(descriptor);
    return this;
  }

  public build(): void {
    for (const descriptor of this.descriptors) {
      const texture: Texture2D = this.assetsLoader.getAsset<Texture2D>(
        descriptor.texture,
      );
      const sheet: SpriteSheet = descriptor.sheet(texture);
      this.registry[descriptor.name] = { sheet, clips: descriptor.clips };
    }
  }

  public createClips(name: string): Record<string, SpriteAnimation> {
    const entry: SheetEntry | undefined = this.registry[name];

    if (!entry) {
      throw new Error(`Sheet not found: ${name}`);
    }

    return entry.clips(entry.sheet);
  }
}
```

- [ ] **Step 7 : Barrel `sheets/index.ts`**

Remplacer le contenu de `apps/dino-brawl/src/game/sheets/index.ts` par :

```ts
export * from "./SheetList";
export * from "./SheetLoader";
export * from "./sheets";
```

- [ ] **Step 8 : Typecheck**

Le module n'est encore consommé nulle part → il doit juste compiler.

```bash
pnpm --filter dino-brawl build
```
Expected: PASS (aucune erreur TS ; `SheetLoader`/`SheetList`/`RunningParticleSheet` compilent).

- [ ] **Step 9 : Lint + prettier (scopé)**

```bash
pnpm exec prettier --write apps/dino-brawl/src/game/sheets/sheets/sheets.types.ts apps/dino-brawl/src/game/sheets/sheets/DinoSheet.ts apps/dino-brawl/src/game/sheets/sheets/RunningParticleSheet.ts apps/dino-brawl/src/game/sheets/sheets/index.ts apps/dino-brawl/src/game/sheets/SheetList.ts apps/dino-brawl/src/game/sheets/SheetLoader.ts apps/dino-brawl/src/game/sheets/index.ts
pnpm --filter dino-brawl lint
```
Expected: PASS.

- [ ] **Step 10 : Stage + handoff (l'utilisateur commit)**

```bash
git add apps/dino-brawl/src/game/sheets
```
Ne PAS commiter. Message suggéré à l'utilisateur :
`feat(dino-brawl): centralize spritesheets (SheetList + SheetLoader.createClips), fix DinoSheet columns`

---

## Task 2 : Prefabs — compléter, corriger, factories runtime

**Files:**
- Modify: `apps/dino-brawl/src/game/prefabs/PlayerPrefab.ts`
- Modify: `apps/dino-brawl/src/game/prefabs/ShadowPrefab.ts`
- Modify (rewrite): `apps/dino-brawl/src/game/prefabs/RunningParticlePrefab.ts`
- Create: `apps/dino-brawl/src/game/prefabs/RunningAudioPrefab.ts`
- Modify: `apps/dino-brawl/src/game/prefabs/index.ts`

**Interfaces:**
- Consumes: `definePrefab`, `EntityBuilder`, `Prefab`, `Animator`, `AudioSource`, `SpriteRenderer`, `Transform2D`, `RigidBody`, `Collider2D`, `CharacterController2D`, `PlayerInput`, `Color`, `Sprite` (@atlasjs/gameplay) ; `AudioClip` (@atlasjs/audio) ; `SpriteAnimation` (@atlasjs/nebula) ; `Vec2` (@atlasjs/math) ; `pickRandom`, `randomRange` (@atlasjs/utils) ; `SortingLayer`, `SortingOrder`, `CollisionLayers` (../config) ; `dinoControls` (../controls) ; `PlayerAnimationScript`, `PlayerMovementScript`, `RunningParticleScript` (../scripts).
- Produces (signatures exactes, consommées par Task 3) :
  - `type PlayerPrefabProps = { position: Vec2; sprite: Sprite; createClips: () => Record<string, SpriteAnimation> }` + `const PlayerPrefab: Prefab<PlayerPrefabProps>`
  - `type ShadowPrefabProps = { sprite: Sprite }` + `const ShadowPrefab: Prefab<ShadowPrefabProps>`
  - `function createRunningParticlePrefab(deps: { sprite: Sprite; sound: AudioClip; createClips: () => Record<string, SpriteAnimation> }): Prefab<{ position: Vec2 }>`
  - `function createRunningAudioPrefab(deps: { sound: AudioClip }): Prefab`

- [ ] **Step 1 : Réécrire `PlayerPrefab.ts` (+ Animator, SpriteRenderer, createClips)**

Remplacer intégralement `apps/dino-brawl/src/game/prefabs/PlayerPrefab.ts` par :

```ts
import type { Vec2 } from "@atlasjs/math";
import type { SpriteAnimation } from "@atlasjs/nebula";

import { PlayerAnimationScript, PlayerMovementScript } from "../scripts";
import { CollisionLayers, SortingLayer, SortingOrder } from "../config";
import { dinoControls } from "../controls";

import {
  Animator,
  CharacterController2D,
  Collider2D,
  definePrefab,
  PlayerInput,
  RigidBody,
  Sprite,
  SpriteRenderer,
  Transform2D,
  type EntityBuilder,
  type Prefab,
} from "@atlasjs/gameplay";

export type PlayerPrefabProps = {
  position: Vec2;
  sprite: Sprite;
  createClips: () => Record<string, SpriteAnimation>;
};

export const PlayerPrefab: Prefab<PlayerPrefabProps> =
  definePrefab<PlayerPrefabProps>({
    name: "player",
    build: (entity: EntityBuilder, props: PlayerPrefabProps): void => {
      const transform: Transform2D = entity.add(Transform2D);
      transform.position.copyFrom(props.position);
      transform.scale.set(3, 3);

      entity.add(Animator, props.createClips(), "idle");

      const renderer: SpriteRenderer = entity.add(SpriteRenderer, props.sprite);
      renderer.sortingLayer = SortingLayer.Entities;
      renderer.sortingOrder = SortingOrder.Player;

      const body: RigidBody = entity.add(RigidBody);
      body.type = "kinematic";

      const collider: Collider2D = entity.add(Collider2D, {
        type: "box",
        width: 32,
        height: 16,
      });
      collider.offset.set(0, -15);
      collider.layer = CollisionLayers.Player;
      collider.collidesWith = CollisionLayers.World;

      entity.add(CharacterController2D);
      entity.add(PlayerInput, dinoControls);

      entity.attach(PlayerAnimationScript);
      entity.attach(PlayerMovementScript, {
        walkingSpeed: 200,
        runningSpeed: 205,
      });
    },
  });
```

Notes : `Animator` ajouté (c'était le vrai manque) via `props.createClips()` — appelé une fois (le joueur est mono-instance). `SpriteRender` → `SpriteRenderer`. `Sprite` est importé en *valeur* (classe) mais n'est utilisé que comme type ici : c'est volontaire et sans risque runtime (c'est un vrai export valeur, pas un type-only). Les deux scripts joueur restent attachés **dans** le prefab (identique à l'actuel).

- [ ] **Step 2 : Réécrire `ShadowPrefab.ts` (aligné sur l'ombre inline)**

L'ombre inline actuelle (dans l'ancien `spawnPlayer`) : scale `(0.7, 0.6)`, position **locale** `(-0.5, -3)`, `color` alpha `0.4`, `sortingOrder = SortingOrder.Shadow`, parentée au joueur. Le prefab ne prend donc PAS de `position` (offset local intrinsèque) ; le parentage est fait par l'appelant (Task 3, via `{ parent }`).

Remplacer intégralement `apps/dino-brawl/src/game/prefabs/ShadowPrefab.ts` par :

```ts
import { SortingLayer, SortingOrder } from "../config";

import {
  Color,
  definePrefab,
  Sprite,
  SpriteRenderer,
  Transform2D,
  type EntityBuilder,
  type Prefab,
} from "@atlasjs/gameplay";

export type ShadowPrefabProps = {
  sprite: Sprite;
};

export const ShadowPrefab: Prefab<ShadowPrefabProps> =
  definePrefab<ShadowPrefabProps>({
    name: "shadow",
    build: (entity: EntityBuilder, props: ShadowPrefabProps): void => {
      const transform: Transform2D = entity.add(Transform2D);
      transform.scale.set(0.7, 0.6);
      transform.position.set(-0.5, -3);

      const renderer: SpriteRenderer = entity.add(SpriteRenderer, props.sprite);
      renderer.sortingLayer = SortingLayer.Entities;
      renderer.sortingOrder = SortingOrder.Shadow;
      renderer.color = new Color(1, 1, 1, 0.4);
    },
  });
```

Note : l'ancien `ShadowPrefab` mettait scale `(3,3)` + `position.copyFrom(props.position)` sans alpha — **incorrect** par rapport au comportement observé. On ne garde plus l'import erroné de `Transform2D` depuis `@atlasjs/math` (désormais `@atlasjs/gameplay`).

- [ ] **Step 3 : Réécrire `RunningParticlePrefab.ts` en factory**

Remplacer intégralement `apps/dino-brawl/src/game/prefabs/RunningParticlePrefab.ts` par :

```ts
import type { Vec2 } from "@atlasjs/math";
import type { AudioClip } from "@atlasjs/audio";
import type { SpriteAnimation } from "@atlasjs/nebula";

import { SortingLayer } from "../config";
import { RunningParticleScript } from "../scripts";

import {
  Animator,
  AudioSource,
  definePrefab,
  Sprite,
  SpriteRenderer,
  Transform2D,
  type EntityBuilder,
  type Prefab,
} from "@atlasjs/gameplay";

export type RunningParticlePrefabDeps = {
  sprite: Sprite;
  sound: AudioClip;
  createClips: () => Record<string, SpriteAnimation>;
};

export function createRunningParticlePrefab(
  deps: RunningParticlePrefabDeps,
): Prefab<{ position: Vec2 }> {
  return definePrefab<{ position: Vec2 }>({
    name: "running_particle",
    build: (entity: EntityBuilder, params: { position: Vec2 }): void => {
      entity.add(Animator, deps.createClips(), "default");
      entity.add(AudioSource, deps.sound);

      const renderer: SpriteRenderer = entity.add(SpriteRenderer, deps.sprite);
      renderer.sortingLayer = SortingLayer.Entities;
      renderer.sortingOrder = 100;

      const transform: Transform2D = entity.add(Transform2D);
      transform.scale.set(2, 2);
      transform.position.copyFrom(params.position);

      entity.attach(RunningParticleScript);
    },
  });
}
```

Note : `build` tourne à chaque `instantiate` → `deps.createClips()` produit des clips frais par particule (correction du bug d'état partagé). `RunningParticleScript.onCreate` réécrit ensuite `scale` — comportement inchangé.

- [ ] **Step 4 : Créer `RunningAudioPrefab.ts` (factory)**

Créer `apps/dino-brawl/src/game/prefabs/RunningAudioPrefab.ts` :

```ts
import type { AudioClip } from "@atlasjs/audio";
import { pickRandom, randomRange } from "@atlasjs/utils";

import {
  AudioSource,
  definePrefab,
  type EntityBuilder,
  type Prefab,
} from "@atlasjs/gameplay";

export type RunningAudioPrefabDeps = {
  sound: AudioClip;
};

export function createRunningAudioPrefab(
  deps: RunningAudioPrefabDeps,
): Prefab {
  return definePrefab({
    name: "running_audio",
    build: (entity: EntityBuilder): void => {
      const audio: AudioSource = entity.add(AudioSource, pickRandom([deps.sound]), {
        playOnAwake: true,
      });
      audio.volume = randomRange(0.01, 0.05);
      audio.pitch = randomRange(1, 1.2);
    },
  });
}
```

- [ ] **Step 5 : Mettre à jour le barrel `prefabs/index.ts`**

Remplacer le contenu de `apps/dino-brawl/src/game/prefabs/index.ts` par :

```ts
export * from "./PlayerPrefab";
export * from "./RunningAudioPrefab";
export * from "./RunningParticlePrefab";
export * from "./ShadowPrefab";
```

- [ ] **Step 6 : Typecheck**

Les prefabs ne sont pas encore consommés par `spawnPlayer` (ça vient en Task 3) → ils doivent juste compiler.

```bash
pnpm --filter dino-brawl build
```
Expected: PASS.

- [ ] **Step 7 : Lint + prettier (scopé)**

```bash
pnpm exec prettier --write apps/dino-brawl/src/game/prefabs/PlayerPrefab.ts apps/dino-brawl/src/game/prefabs/ShadowPrefab.ts apps/dino-brawl/src/game/prefabs/RunningParticlePrefab.ts apps/dino-brawl/src/game/prefabs/RunningAudioPrefab.ts apps/dino-brawl/src/game/prefabs/index.ts
pnpm --filter dino-brawl lint
```
Expected: PASS.

- [ ] **Step 8 : Stage + handoff**

```bash
git add apps/dino-brawl/src/game/prefabs
```
Message suggéré : `feat(dino-brawl): complete player/shadow/particle prefabs + running-audio prefab factory`

---

## Task 3 : `spawnPlayer` mince + câblage `ArenaScene`

**Files:**
- Modify (rewrite): `apps/dino-brawl/src/game/spawn/spawnPlayer.ts`
- Modify: `apps/dino-brawl/src/game/ArenaScene.ts`

**Interfaces:**
- Consumes (de Task 1) : `SheetLoader`, `SheetList`, `SheetLoader.createClips(name)`. (De Task 2) : `PlayerPrefab`, `ShadowPrefab`, `createRunningParticlePrefab`, `createRunningAudioPrefab`. (Existant) : `AssetsLoader.getAsset`, `INSTANTIATOR`/`Instantiator.instantiate(prefab, params, { parent })` → `GameEntity` (`.id: Entity`), `SCRIPT_MANAGER`/`ScriptManager.attach`, `NEXUS`.
- Produces : `spawnPlayer(ctx, spawnPosition, assetsLoader, sheetLoader): Promise<{ player: Entity; shadow: Entity }>` ; `ArenaScene` construit et remplit le `SheetLoader` puis le passe à `spawnPlayer`.

- [ ] **Step 1 : Réécrire `spawnPlayer.ts`**

Remplacer intégralement `apps/dino-brawl/src/game/spawn/spawnPlayer.ts` par :

```ts
import type { Vec2 } from "@atlasjs/math";
import type { AudioClip } from "@atlasjs/audio";
import type { SpriteAnimation } from "@atlasjs/nebula";
import type { SceneContext } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";

import {
  type Instantiator,
  type Prefab,
  type ScriptManager,
  type Sprite,
  INSTANTIATOR,
  SCRIPT_MANAGER,
} from "@atlasjs/gameplay";

import type { AssetsLoader } from "../loaders";
import type { SheetLoader } from "../sheets";
import {
  createRunningAudioPrefab,
  createRunningParticlePrefab,
  PlayerPrefab,
  ShadowPrefab,
} from "../prefabs";
import { RunningAudioPlayerScript, RunningParticleSpawnerScript } from "../scripts";

type PlayerSpawned = {
  player: Entity;
  shadow: Entity;
};

export async function spawnPlayer(
  ctx: SceneContext,
  spawnPosition: Vec2,
  assetsLoader: AssetsLoader,
  sheetLoader: SheetLoader,
): Promise<PlayerSpawned> {
  const nexus: NexusWorld = ctx.services.get(NEXUS);
  const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);
  const instantiator: Instantiator = ctx.services.get(INSTANTIATOR);

  const dinoSprite: Sprite = assetsLoader.getAsset("sprite:yellow_dino");
  const shadowSprite: Sprite = assetsLoader.getAsset("sprite:shadow");
  const particleSprite: Sprite = assetsLoader.getAsset("sprite:running_particle");
  const grassSound: AudioClip = assetsLoader.getAsset("audio:grass_audio");

  const dinoClips: () => Record<string, SpriteAnimation> = () =>
    sheetLoader.createClips("sheet:dino");
  const particleClips: () => Record<string, SpriteAnimation> = () =>
    sheetLoader.createClips("sheet:running_particle");

  const player: Entity = instantiator.instantiate(PlayerPrefab, {
    position: spawnPosition,
    sprite: dinoSprite,
    createClips: dinoClips,
  }).id;

  const shadow: Entity = instantiator.instantiate(
    ShadowPrefab,
    { sprite: shadowSprite },
    { parent: player },
  ).id;

  const runningParticlePrefab: Prefab<{ position: Vec2 }> =
    createRunningParticlePrefab({
      sprite: particleSprite,
      sound: grassSound,
      createClips: particleClips,
    });

  const runningAudioPrefab: Prefab = createRunningAudioPrefab({
    sound: grassSound,
  });

  scriptManager.attach(player, RunningParticleSpawnerScript, {
    runningParticlePrefab: runningParticlePrefab,
  });

  scriptManager.attach(player, RunningAudioPlayerScript, {
    audioPrefab: runningAudioPrefab,
  });

  return { player, shadow };
}
```

Notes :
- `nexus` reste utilisé ? Non — `NexusWorld`/`NEXUS` ne servent plus si tout passe par `Instantiator`. **Retirer** `nexus`/`NexusWorld`/`NEXUS` de ce fichier si `pnpm lint` les signale inutilisés. Vérifier au Step 3 : si le lint remonte `nexus` non utilisé, supprimer la ligne `const nexus` et l'import `{ type NexusWorld, NEXUS }` (garder `type Entity`).
- `PlayerAnimationScript`/`PlayerMovementScript` ne sont PAS ré-attachés ici : ils le sont dans `PlayerPrefab.build` (Task 2). Ne pas les importer.
- Le parentage ombre→joueur se fait via l'option `{ parent: player }` de `instantiate` (plus de `nexus.setParent` manuel).

- [ ] **Step 2 : Câbler `ArenaScene.ts`**

Dans `apps/dino-brawl/src/game/ArenaScene.ts` :

(a) Ajouter l'import du module sheets, sous l'import des loaders existant :
```ts
import { SheetList, SheetLoader } from "./sheets";
```

(b) Dans `onCreate`, juste après `await this.loadAssets(assetsLoader);`, insérer :
```ts
    const sheetLoader: SheetLoader = new SheetLoader(assetsLoader);
    this.loadSheets(sheetLoader);
```

(c) Remplacer l'appel :
```ts
    const { player } = await spawnPlayer(ctx, spawnPosition, assetsLoader);
```
par :
```ts
    const { player } = await spawnPlayer(
      ctx,
      spawnPosition,
      assetsLoader,
      sheetLoader,
    );
```

(d) Ajouter la méthode privée `loadSheets` (à côté de `loadAssets`) :
```ts
  private loadSheets(sheetLoader: SheetLoader): void {
    for (const descriptor of SheetList) {
      sheetLoader.addSheet(descriptor);
    }

    sheetLoader.build();
  }
```

Ne rien changer d'autre (`initAssets`, `initLayer`, `loadAssets`, `spawnWorld`, `spawnCamera` restent identiques).

- [ ] **Step 3 : Typecheck + lint + prettier (scopé)**

```bash
pnpm --filter dino-brawl build
pnpm exec prettier --write apps/dino-brawl/src/game/spawn/spawnPlayer.ts apps/dino-brawl/src/game/ArenaScene.ts
pnpm --filter dino-brawl lint
```
Expected: PASS. Si le lint signale `nexus`/`NexusWorld`/`NEXUS` inutilisés dans `spawnPlayer.ts`, appliquer la suppression décrite au Step 1 puis relancer.

- [ ] **Step 4 : Stage + handoff**

```bash
git add apps/dino-brawl/src/game/spawn/spawnPlayer.ts apps/dino-brawl/src/game/ArenaScene.ts
```
Message suggéré : `refactor(dino-brawl): thin spawnPlayer via Instantiator + wire SheetLoader in ArenaScene`

---

## Task 4 : Vérification navigateur (comportement identique)

**Files:** aucune modification de code attendue (tâche de vérification ; corriger en amont si un défaut apparaît).

**Interfaces:** consomme l'état complet des Tasks 1-3.

- [ ] **Step 1 : Vérifier qu'aucune scorie ne subsiste**

```bash
grep -rn "SpriteRender\b" apps/dino-brawl/src/game/prefabs
grep -rn "@atlasjs/math" apps/dino-brawl/src/game/prefabs
```
Expected : le 1er ne retourne QUE des `SpriteRenderer` (pas de `SpriteRender` nu) ; le 2nd ne retourne que des imports `Vec2` légitimes (aucun `Transform2D` depuis `@atlasjs/math`).

- [ ] **Step 2 : Build complet**

```bash
pnpm --filter dino-brawl build
```
Expected: PASS.

- [ ] **Step 3 : Vérification navigateur**

Appliquer le **Protocole de vérification navigateur** (en tête de plan). Checklist :
- dino visible et **animé** (idle à l'arrêt, run/sprint en déplacement WASD + boost Espace) ;
- **ombre** semi-transparente (alpha ~0.4), plus petite, sous le dino, qui le suit ;
- **particules de course** qui apparaissent derrière le dino en courant puis disparaissent ;
- **son grass** audible en courant (si l'audio est activé dans l'environnement de preview) ;
- `read_console_messages` : **aucune erreur** (notamment pas d'écran noir type import — cf. contrainte `import type`).

Si un point échoue : diagnostiquer (source → fix dans la task concernée), re-typecheck, re-vérifier. Ne pas masquer un écart.

- [ ] **Step 4 : Screenshot de preuve**

`computer { action: "screenshot" }` → joindre l'image à l'utilisateur comme preuve (dino + ombre + particules).

- [ ] **Step 5 : Handoff final**

Résumer à l'utilisateur : ce qui a changé, la preuve visuelle, et le rappel que rien n'est commité (à lui de committer les 4 lots, ou en un seul, selon sa préférence).

---

## Self-Review (auteur)

- **Spec coverage :** sheets mirror `loaders/` (Task 1) ✓ ; prefabs complétés + factories runtime (Task 2) ✓ ; `spawnPlayer` mince via Instantiator + wiring ArenaScene (Task 3) ✓ ; cleanup `SpriteRender→SpriteRenderer` + `Transform2D` import (Task 2, vérifié Task 4) ✓ ; `DinoSheet columns:24` (Task 1) ✓ ; `createClips` fresh-per-instance (Task 1+2) ✓ ; `ResourcesPath` conservé (contrainte globale) ✓ ; browser-verify (Task 4) ✓.
- **Placeholders :** aucun — chaque step montre le code complet.
- **Cohérence des types :** `SheetLoader.createClips(name): Record<string, SpriteAnimation>` cohérent entre Task 1 (def), Task 2 (prop `createClips`) et Task 3 (thunks). `instantiate(...).id: Entity` cohérent avec le retour `{ player: Entity; shadow: Entity }` et `spawnCamera(ctx, player)`. Noms logiques `"sheet:dino"`/`"sheet:running_particle"` identiques entre `SheetList` (Task 1) et `spawnPlayer` (Task 3).
