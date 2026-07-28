# Dino Brawl — nettoyage & mise au propre — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renommer `apps/sandbox` en `apps/dino-brawl`, nettoyer le code mort, centraliser les constantes, et déplacer toute la composition/config statique des scripts vers des fonctions de spawn locales — sans aucun changement de comportement à l'écran.

**Architecture:** Un principe directeur unique — *un script = du comportement par frame ; la composition et la config initiale vivent dans une fonction de spawn*. La scène orchestre des fonctions `spawn*` locales ; les constantes partagées (sorting layers, collision layers, ordres de tri, échelle de map) vivent dans un `config.ts` ; le loader Tiled est nettoyé sur place.

**Tech Stack:** TypeScript, React 19, Vite 7, Turborepo/pnpm, Vitest 4, AtlasJS packages (`@atlasjs/gameplay`, `@atlasjs/nexus`, `@atlasjs/nebula`, etc.).

**Spec source:** [`docs/dino-brawl-cleanup.md`](dino-brawl-cleanup.md).

## Global Constraints

- **Zéro changement de comportement.** Le jeu doit rester **strictement identique à l'écran** (positions, animations, caméra, épée, tri Y). Ce chantier est un refactor structurel.
- **Toujours typer** (params, variables, champs de classe) — règle `CLAUDE.md`. Type de retour explicite sur toute fonction non triviale.
- **`import type` obligatoire** pour tout symbole *type-only* dans les fichiers d'app (`verbatimModuleSyntax: true`). Un import de valeur d'un type-only compile sous tsc mais casse Vite au runtime (écran noir).
- **Pas d'`enum` TS** (`erasableSyntaxOnly: true` dans les tsconfig) → utiliser des `const` objets `as const`.
- **Pas de commentaires** dans le code (règle `CLAUDE.md`).
- **Pas de commit automatique au-delà des commits de tâche** : ce plan commit à chaque tâche ; ne pas squash ni push sans demande explicite.
- **Toutes les commandes se lancent depuis la racine du repo** (`/Users/AlexisEnSah/Desktop/Node/atlas`).

## Protocole de vérification navigateur (référencé par les tâches visuelles)

Le pane WebGPU sert des scènes *stales* sous HMR → **redémarrer le dev server, pas de HMR**.

1. `preview_start` avec `{ name: "dino-brawl" }` (après la tâche 1 qui renomme la config launch).
2. Si un serveur tourne déjà : `preview_stop` puis `preview_start` pour repartir propre.
3. `read_console_messages` (erreurs) + `read_page` (structure).
4. `computer { action: "screenshot" }` pour la preuve visuelle.
5. Comparer au screenshot de référence pris **avant** la tâche 1 (voir Task 1, Step 1).

---

## Task 1 : Renommer l'app `sandbox` → `dino-brawl`

**Files:**
- Move: `apps/sandbox/` → `apps/dino-brawl/` (dossier entier, via `git mv`)
- Modify: `apps/dino-brawl/package.json` (champ `name`)
- Modify: `apps/dino-brawl/index.html` (`<title>`)
- Modify: `apps/dino-brawl/tsconfig.app.json` (alias `@sandbox` → `@dino-brawl`)
- Modify: `.claude/launch.json` (config `sandbox`)
- Modify: `docs/**/*.md` + `CLAUDE.md` (refs `apps/sandbox`)

**Interfaces:**
- Produces: l'app est buildable/lançable sous le nom `dino-brawl` ; `preview_start { name: "dino-brawl" }` fonctionne. Aucun symbole de code renommé (le renommage est purement métadonnées + chemin).

- [ ] **Step 1 : Screenshot de référence AVANT tout changement**

Lancer le jeu tel quel et capturer l'état de référence pour la comparaison finale.

`preview_start` avec `{ name: "sandbox" }`, attendre le rendu, puis `computer { action: "screenshot" }`. Garder cette image comme référence (dino + map + arbres + ombre visibles).

- [ ] **Step 2 : Déplacer le dossier avec git**

```bash
git mv apps/sandbox apps/dino-brawl
```

- [ ] **Step 3 : Renommer le package**

Dans `apps/dino-brawl/package.json`, remplacer `"name": "sandbox"` par `"name": "dino-brawl"`.

- [ ] **Step 4 : Titre HTML + alias tsconfig**

Dans `apps/dino-brawl/index.html`, remplacer `<title>sandbox</title>` par `<title>Dino Brawl</title>`.

Dans `apps/dino-brawl/tsconfig.app.json`, remplacer l'entrée de `paths` `"@sandbox/*": ["./src/*"]` par `"@dino-brawl/*": ["./src/*"]` (alias inutilisé aujourd'hui — grep `@sandbox` dans `src/` retourne 0 ; on le renomme par cohérence).

- [ ] **Step 5 : Config de lancement**

Dans `.claude/launch.json`, config `sandbox` → :

```json
{
  "name": "dino-brawl",
  "runtimeExecutable": "pnpm",
  "runtimeArgs": ["--filter", "dino-brawl", "dev"],
  "port": 5173,
  "autoPort": true
}
```

- [ ] **Step 6 : Références dans docs + CLAUDE.md**

```bash
grep -rl "apps/sandbox" docs/ CLAUDE.md | xargs sed -i '' 's#apps/sandbox#apps/dino-brawl#g'
```

Puis relire les mentions du mot « sandbox » restantes et corriger celles qui désignent l'app (pas le concept générique) :

```bash
grep -rni "sandbox" docs/ CLAUDE.md
```

Remplacer `apps/sandbox` déjà fait ; pour les tournures type « la sandbox » / « le sandbox » qui désignent cette app précise, remplacer par « l'app `dino-brawl` ». Laisser les emplois génériques du mot s'il y en a.

- [ ] **Step 7 : Réinstaller et builder**

```bash
pnpm install
pnpm --filter dino-brawl build
```
Expected: `pnpm install` relie le workspace `dino-brawl` (glob `apps/*`, pas de changement de `pnpm-workspace.yaml`) ; le build (`tsc -b && vite build`) passe sans erreur.

- [ ] **Step 8 : Lint**

```bash
pnpm --filter dino-brawl lint
```
Expected: PASS.

- [ ] **Step 9 : Vérification navigateur**

Appliquer le Protocole de vérification navigateur avec `{ name: "dino-brawl" }`. Screenshot identique à la référence du Step 1.

- [ ] **Step 10 : Commit**

```bash
git add -A
git commit -m "refactor(dino-brawl): rename sandbox app to dino-brawl"
```

---

## Task 2 : Constantes centrales (`config.ts`) + contrôles partagés (`controls.ts`)

**Files:**
- Create: `apps/dino-brawl/src/game/config.ts`
- Create: `apps/dino-brawl/src/game/controls.ts`
- Modify: `apps/dino-brawl/src/game/EcsScene.ts` (consomme config + controls)
- Modify: `apps/dino-brawl/src/game/scripts/PlayerScript.ts` (type `DinoControls`)
- Modify: `apps/dino-brawl/src/game/scripts/PlayerMovementScript.ts` (type `DinoControls`)

**Interfaces:**
- Produces:
  - `config.ts` exporte `SortingLayer` (`{ Ground, Entities, Overhead }` `as const`) + type `SortingLayerName`, `SortingOrder` (`{ Shadow: 8, Player: 10, Sword: 20 }` `as const`), `CollisionLayers` (résultat de `defineCollisionLayers("Player","Occluder")`), `MAP_SCALE: number = 2`.
  - `controls.ts` exporte `dinoControls` (résultat de `defineActions`) + type `DinoControls = (typeof dinoControls)["specs"]`.
- Consumes: `defineCollisionLayers`, `defineActions`, `vector2`, `button`, `Key` depuis `@atlasjs/gameplay`.

- [ ] **Step 1 : Écrire `config.ts`**

```ts
import { defineCollisionLayers } from "@atlasjs/gameplay";

export const SortingLayer = {
  Ground: "Ground",
  Entities: "Entities",
  Overhead: "Overhead",
} as const;

export type SortingLayerName = (typeof SortingLayer)[keyof typeof SortingLayer];

export const SortingOrder = {
  Shadow: 8,
  Player: 10,
  Sword: 20,
} as const;

export const CollisionLayers = defineCollisionLayers("Player", "Occluder");

export const MAP_SCALE: number = 2;
```

- [ ] **Step 2 : Écrire `controls.ts`**

```ts
import { Key, button, defineActions, vector2 } from "@atlasjs/gameplay";

export const dinoControls = defineActions({
  move: vector2().wasd(),
  boost: button().keys(Key.Space),
});

export type DinoControls = (typeof dinoControls)["specs"];
```

Note : l'action `hello` (`button().keys(Key.MouseLeft)`) présente dans l'ancien `defineActions` est **supprimée** — jamais lue par aucun script.

- [ ] **Step 3 : Consommer dans `EcsScene.ts`**

Dans `EcsScene.ts` :
- Supprimer les lignes `const MAP_SCALE: number = 2;` et `const Layers = defineCollisionLayers("Player", "Occluder");`.
- Supprimer le bloc inline `const controls = defineActions({ move, boost, hello });`.
- Ajouter les imports : `import { SortingLayer, SortingOrder, CollisionLayers, MAP_SCALE } from "./config";` et `import { dinoControls } from "./controls";`.
- Retirer `defineActions`, `defineCollisionLayers`, `vector2`, `button`, `Key` de l'import `@atlasjs/gameplay` (désormais inutilisés dans la scène).
- Remplacer la définition des sorting layers par les noms typés :
```ts
sortingLayers.define([
  { name: SortingLayer.Ground, mode: "manual" },
  { name: SortingLayer.Entities, mode: "ySorted" },
  { name: SortingLayer.Overhead, mode: "manual" },
]);
```
- Remplacer chaque `.sortingLayer = "Ground"` par `.sortingLayer = SortingLayer.Ground` et `.sortingLayer = "Entities"` par `.sortingLayer = SortingLayer.Entities`.
- Remplacer `nexus.addComponent(player, PlayerInput, controls)` par `nexus.addComponent(player, PlayerInput, dinoControls)`.
- Remplacer les usages de `Layers.Player`/`Layers.Occluder` par `CollisionLayers.Player`/`CollisionLayers.Occluder`.
- Remplacer `shadowRender.sortingOrder = -1;` par `shadowRender.sortingOrder = SortingOrder.Shadow;` (voir note ci-dessous).

Note comportement : l'ancienne valeur `-1` de l'ombre était **écrasée** par `PlayerScript.onCreate` (`spriteRendererShadow.sortingOrder = 8`) avant tout rendu → la valeur effective a toujours été `8`. On pose donc directement `SortingOrder.Shadow` (= 8). `PlayerScript` continuera de la re-poser à `8` dans cette tâche (nettoyé en Task 7) — valeur identique, aucun changement visuel.

- [ ] **Step 4 : Typer les scripts joueur avec `DinoControls`**

Dans `PlayerScript.ts` et `PlayerMovementScript.ts` :
- Supprimer la déclaration locale `type Inputs = { move: Vector2ActionSpec; boost: ButtonActionSpec; hello: ButtonActionSpec };`.
- Ajouter `import type { DinoControls } from "../controls";`.
- Remplacer `PlayerInput<Inputs>` par `PlayerInput<DinoControls>`.
- Retirer `Vector2ActionSpec`/`ButtonActionSpec` des imports type s'ils ne sont plus utilisés (ils ne le sont plus une fois `Inputs` supprimé).

- [ ] **Step 5 : Build**

```bash
pnpm --filter dino-brawl build
```
Expected: PASS. (Le type `DinoControls = (typeof dinoControls)["specs"]` résout vers le record `{ move: ...; boost: ... }`, compatible avec `PlayerInput<T extends Record<string, AnyActionSpec>>`.)

- [ ] **Step 6 : Lint**

```bash
pnpm --filter dino-brawl lint
```
Expected: PASS (aucun import inutilisé résiduel).

- [ ] **Step 7 : Vérification navigateur**

Protocole navigateur. Screenshot identique à la référence : mouvement WASD + boost Espace fonctionnent, tri identique.

- [ ] **Step 8 : Commit**

```bash
git add -A
git commit -m "refactor(dino-brawl): centralize config + shared controls, drop dead hello action"
```

---

## Task 3 : Séparer le shell React (`app/`)

**Files:**
- Create: `apps/dino-brawl/src/app/App.tsx`
- Create: `apps/dino-brawl/src/app/GameCanvas.tsx`
- Create: `apps/dino-brawl/src/app/DebugOverlay.tsx`
- Delete: `apps/dino-brawl/src/App.tsx`
- Delete: `apps/dino-brawl/src/Window.tsx`
- Modify: `apps/dino-brawl/src/main.tsx` (import `./app/App`)

**Interfaces:**
- Consumes: `EcsScene` depuis `../game`, `throttle` depuis `../utils`.
- Produces: `<App />` compose `<GameCanvas onFps={setFps} />` + `<DebugOverlay fps={fps} />`. `GameCanvas` possède le `useEffect` moteur (plugins, canvas, cycle de vie) et appelle `onFps(frame)` (throttlé). `DebugOverlay` affiche `fps`.

- [ ] **Step 1 : Écrire `DebugOverlay.tsx`**

```tsx
import type { ReactNode } from "react";

export function DebugOverlay({ fps }: { fps: number }): ReactNode {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 1,
        color: "white",
        padding: "10px",
      }}
    >
      <span>{fps} fps</span>
    </div>
  );
}
```

- [ ] **Step 2 : Écrire `GameCanvas.tsx`**

Déplacer tel quel le `useEffect` moteur de l'ancien `App.tsx`, en le paramétrant par un callback `onFps`.

```tsx
import { type RefObject, useEffect, useRef } from "react";

import { Engine } from "@atlasjs/core";
import { AssetPlugin } from "@atlasjs/assets";
import { InputPlugin } from "@atlasjs/input";
import { NexusPlugin } from "@atlasjs/nexus";
import { InertialPlugin } from "@atlasjs/inertia";
import { RapierPhysicsWorld } from "@atlasjs/rapier";
import { GameplayPlugin } from "@atlasjs/gameplay";
import { NebulaPlugin } from "@atlasjs/nebula";
import { WebGPURenderer } from "@atlasjs/nebula-webgpu";

import { EcsScene } from "../game";
import { throttle } from "../utils";

export function GameCanvas({ onFps }: { onFps: (fps: number) => void }): React.ReactNode {
  const mountRef: RefObject<HTMLCanvasElement | null> =
    useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const engine: Engine = new Engine();
    const mount: HTMLCanvasElement | null = mountRef.current;

    if (!mount) {
      throw new Error("Mount element not found");
    }

    const renderer: WebGPURenderer = new WebGPURenderer(mount);
    const assetPlugin: AssetPlugin = new AssetPlugin();
    const rendererPlugin: NebulaPlugin = new NebulaPlugin(renderer);
    const nexusPlugin: NexusPlugin = new NexusPlugin();
    const gameplayPlugin: GameplayPlugin = new GameplayPlugin();

    const rapierWorld: RapierPhysicsWorld = new RapierPhysicsWorld({ unitsPerMeter: 100 });
    const inertiaPlugin: InertialPlugin = new InertialPlugin(rapierWorld);

    const inputPlugin: InputPlugin = new InputPlugin({
      target: mountRef.current || document.body,
    });

    engine
      .use(assetPlugin)
      .use(inputPlugin)
      .use(inertiaPlugin)
      .use(rendererPlugin)
      .use(nexusPlugin)
      .use(gameplayPlugin);

    engine.start().then(() => {
      const cb = throttle((frame: number) => {
        onFps(Math.round(frame));
      }, 250);

      engine.scene.set(new EcsScene(cb));
    });

    return () => engine.stop();
  }, [onFps]);

  return <canvas ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
}
```

Note : conserver `.then()` et la structure exacte du bootstrap (aucun changement de cycle de vie). Retirer les commentaires `// prettier-ignore` (règle : pas de commentaires ; le formatage restera correct via prettier).

- [ ] **Step 3 : Écrire `app/App.tsx`**

```tsx
import { type ReactNode, useState } from "react";

import { DebugOverlay } from "./DebugOverlay";
import { GameCanvas } from "./GameCanvas";

export function App(): ReactNode {
  const [fps, setFps] = useState<number>(0);

  return (
    <div>
      <DebugOverlay fps={fps} />
      <GameCanvas onFps={setFps} />
    </div>
  );
}
```

- [ ] **Step 4 : Supprimer les anciens fichiers + mettre à jour `main.tsx`**

```bash
git rm apps/dino-brawl/src/App.tsx apps/dino-brawl/src/Window.tsx
```

Dans `apps/dino-brawl/src/main.tsx`, remplacer `import { App } from "./App";` par `import { App } from "./app/App";`.

- [ ] **Step 5 : Build + lint**

```bash
pnpm --filter dino-brawl build && pnpm --filter dino-brawl lint
```
Expected: PASS. (`Window.tsx` n'était importé nulle part — grep `Window` dans `src/` ne retournait que sa propre définition.)

- [ ] **Step 6 : Vérification navigateur**

Protocole navigateur. Le compteur FPS s'affiche en haut à gauche, le jeu tourne, screenshot identique.

- [ ] **Step 7 : Commit**

```bash
git add -A
git commit -m "refactor(dino-brawl): split App into GameCanvas + DebugOverlay, drop unused Window"
```

---

## Task 4 : Nettoyer le loader Tiled (`map-loader/` → `tiled/`) + corriger les défauts

**Files:**
- Move: `apps/dino-brawl/src/game/map-loader/` → `apps/dino-brawl/src/game/tiled/` (aplatir `map-object/` dans `tiled/`)
- Delete: `apps/dino-brawl/src/game/tiled/Layer.ts` (l'ancien `map-loader/Layer.ts`, classe `TileLayer` morte)
- Rename: `map-object.types.ts` → `map.types.ts`, `tiled.type.ts` → `tiled.types.ts`
- Modify: `tiled/TileSet.ts` (assigner `tileWidth`/`tileHeight`, normaliser `firstGid`)
- Modify: `tiled/MapLoader.ts` (type de retour explicite), `tiled/LayerManager.ts` (supprimer `addLayer`), `tiled/index.ts`, `tiled/tiled.types.ts` (typo `tileidth`)
- Modify: `apps/dino-brawl/src/game/EcsScene.ts` + `scripts/MapBuilderScript.ts` (chemins d'import)
- Create: `apps/dino-brawl/vitest.config.ts`
- Create: `apps/dino-brawl/test/tiled/TileSet.test.ts`
- Modify: `apps/dino-brawl/package.json` (script `test`)

**Interfaces:**
- Consumes: valeurs réelles des tilesets de la map (grass : `firstGid=1, columns=8, tileCount=64` ; props : `firstGid=65, columns=16, tileCount=256`).
- Produces: `TileSet.getId(id): TileIndex` inchangé numériquement pour tout `id` valide ; `TileSet` avec `tileWidth`/`tileHeight` réellement assignés ; `MapLoader.getSerializedLayer(name): SerializedTile[]` typé ; barrel `tiled/index.ts`.

- [ ] **Step 1 : Ajouter le runner de tests à l'app**

Dans `apps/dino-brawl/package.json`, ajouter au bloc `scripts` : `"test": "vitest run"`.

Créer `apps/dino-brawl/vitest.config.ts` (miroir de `packages/nebula/vitest.config.ts`, avec les flags de build de l'app) :

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __DEV__: "false",
    __CONSOLE_TRANSPORT__: "true",
    __WEBSOCKET_TRANSPORT__: "false",
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
```

- [ ] **Step 2 : Déplacer et aplatir le dossier**

```bash
git mv apps/dino-brawl/src/game/map-loader apps/dino-brawl/src/game/tiled
git rm apps/dino-brawl/src/game/tiled/Layer.ts
git mv apps/dino-brawl/src/game/tiled/map-object/Layer.ts apps/dino-brawl/src/game/tiled/Layer.ts
git mv apps/dino-brawl/src/game/tiled/map-object/LayerManager.ts apps/dino-brawl/src/game/tiled/LayerManager.ts
git mv apps/dino-brawl/src/game/tiled/map-object/MapObject.ts apps/dino-brawl/src/game/tiled/MapObject.ts
git mv apps/dino-brawl/src/game/tiled/map-object/MapObjectBuilder.ts apps/dino-brawl/src/game/tiled/MapObjectBuilder.ts
git mv apps/dino-brawl/src/game/tiled/map-object/MapObjectManager.ts apps/dino-brawl/src/game/tiled/MapObjectManager.ts
git mv apps/dino-brawl/src/game/tiled/map-object/TileSet.ts apps/dino-brawl/src/game/tiled/TileSet.ts
git mv apps/dino-brawl/src/game/tiled/map-object/TileSetManager.ts apps/dino-brawl/src/game/tiled/TileSetManager.ts
git mv apps/dino-brawl/src/game/tiled/map-object/map-object.types.ts apps/dino-brawl/src/game/tiled/map.types.ts
git mv apps/dino-brawl/src/game/tiled/map-object/tiled.type.ts apps/dino-brawl/src/game/tiled/tiled.types.ts
git mv apps/dino-brawl/src/game/tiled/map-object/index.ts apps/dino-brawl/src/game/tiled/map-object-index-TO-MERGE.ts
```

Note : l'ancien `map-loader/index.ts` (barrel racine) et l'ancien `map-object/index.ts` seront fusionnés en un seul `tiled/index.ts` au Step 6. Le `map-object/` doit finir vide et être supprimé :

```bash
rmdir apps/dino-brawl/src/game/tiled/map-object 2>/dev/null || true
```

- [ ] **Step 3 : Écrire le test de caractérisation `TileSet` (échoue d'abord)**

Créer `apps/dino-brawl/test/tiled/TileSet.test.ts`. Ces valeurs pinnent l'arithmétique `getId` (identique à l'ancienne pour tout `id` valide) et fixent la sémantique de bornes corrigée de `isIdIn`.

```ts
import { describe, expect, it } from "vitest";

import { TileSet } from "../../src/game/tiled/TileSet";

const grass = new TileSet({
  name: "grass-tileset",
  columns: 8,
  imageHeight: 256,
  imageWidth: 256,
  tileWidth: 32,
  tileHeight: 32,
  tileCount: 64,
  firstGid: 1,
});

const props = new TileSet({
  name: "props",
  columns: 16,
  imageHeight: 512,
  imageWidth: 512,
  tileWidth: 32,
  tileHeight: 32,
  tileCount: 256,
  firstGid: 65,
});

describe("TileSet.getId", () => {
  it("maps grass gids to grid indices", () => {
    expect(grass.getId(1)).toEqual({ x: 0, y: 7 });
    expect(grass.getId(2)).toEqual({ x: 1, y: 7 });
    expect(grass.getId(9)).toEqual({ x: 0, y: 6 });
    expect(grass.getId(64)).toEqual({ x: 7, y: 0 });
  });

  it("maps props gids to grid indices", () => {
    expect(props.getId(65)).toEqual({ x: 0, y: 15 });
    expect(props.getId(81)).toEqual({ x: 0, y: 14 });
  });
});

describe("TileSet.isIdIn", () => {
  it("bounds grass to [firstGid, firstGid + tileCount - 1]", () => {
    expect(grass.isIdIn(1)).toBe(true);
    expect(grass.isIdIn(64)).toBe(true);
    expect(grass.isIdIn(0)).toBe(false);
    expect(grass.isIdIn(65)).toBe(false);
  });

  it("bounds props to [firstGid, firstGid + tileCount - 1]", () => {
    expect(props.isIdIn(65)).toBe(true);
    expect(props.isIdIn(320)).toBe(true);
    expect(props.isIdIn(64)).toBe(false);
    expect(props.isIdIn(321)).toBe(false);
  });
});

describe("TileSet dimensions", () => {
  it("exposes tile dimensions from the descriptor", () => {
    expect(grass.tileWidth).toBe(32);
    expect(grass.tileHeight).toBe(32);
  });
});
```

- [ ] **Step 4 : Lancer le test — il échoue**

```bash
pnpm --filter dino-brawl test
```
Expected: FAIL. `getId`/`isIdIn` sur l'ancienne implémentation ne donnent pas ces bornes (l'ancien `isIdIn` accepte `[firstGid-1, firstGid+tileCount-2]`, décalé de 1) ; `tileWidth`/`tileHeight` sont `undefined`.

- [ ] **Step 5 : Réécrire `TileSet.ts` (normalisé + dimensions assignées)**

```ts
import type { TileSetConstructorData, TileIndex } from "./map.types";

export class TileSet {
  public readonly name: string;
  public readonly columns: number;
  public readonly imageHeight: number;
  public readonly imageWidth: number;
  public readonly tileCount: number;
  public readonly firstGid: number;
  public readonly tileWidth: number;
  public readonly tileHeight: number;
  public readonly lastGid: number;

  public constructor(data: TileSetConstructorData) {
    this.name = data.name;
    this.columns = data.columns;
    this.imageHeight = data.imageHeight;
    this.imageWidth = data.imageWidth;
    this.tileCount = data.tileCount;
    this.tileWidth = data.tileWidth;
    this.tileHeight = data.tileHeight;
    this.firstGid = data.firstGid;
    this.lastGid = this.firstGid + this.tileCount - 1;
  }

  public getId(id: number): TileIndex {
    const localId: number = id - this.firstGid;

    if (localId < 0) {
      throw new Error(`getId: id ${id} is before firstGid ${this.firstGid}`);
    }

    if (localId >= this.tileCount) {
      throw new Error(`getId: id ${id} is after lastGid ${this.lastGid}`);
    }

    const x: number = localId % this.columns;
    const y: number = this.columns - 1 - Math.floor(localId / this.columns);

    return { x, y };
  }

  public isIdIn(id: number): boolean {
    return id >= this.firstGid && id <= this.lastGid;
  }
}
```

Notes :
- `firstGid` est maintenant le vrai `firstgid` Tiled (1-based). `localId = id - firstGid` produit **exactement** l'ancien `localId` (l'ancien code : `firstGid_stored = data.firstGid - 1` puis `id - 1 - firstGid_stored = id - data.firstGid`). L'arithmétique `getId` est donc byte-identique → le double `-1` qui se compensait est éliminé.
- La ligne `y = this.columns - 1 - Math.floor(...)` est **conservée telle quelle** (comportement existant ; ne pas la « corriger »).
- `isIdIn`/`lastGid` passent à la convention correcte `[firstGid, firstGid + tileCount - 1]`. C'est une **correction d'un off-by-one latent** (l'ancien acceptait le dernier gid d'un tileset comme hors-borne). Gate : la vérification navigateur du Step 9 doit montrer une map **pixel-identique** ; **si un tile diffère, s'arrêter et rapporter** (cela signifierait qu'un gid de bordure était mal routé auparavant — décision à remonter, ne pas masquer).

- [ ] **Step 6 : Fusionner les barrels en `tiled/index.ts`**

Contenu final de `apps/dino-brawl/src/game/tiled/index.ts` :

```ts
export * from "./Layer";
export * from "./LayerManager";
export * from "./MapLoader";
export * from "./MapObject";
export * from "./MapObjectBuilder";
export * from "./MapObjectManager";
export * from "./TileSet";
export * from "./TileSetManager";
export * from "./map.types";
export * from "./tiled.types";
```

Supprimer le fichier temporaire de fusion :

```bash
git rm apps/dino-brawl/src/game/tiled/map-object-index-TO-MERGE.ts
```

- [ ] **Step 7 : Corriger les imports internes + défauts restants**

- Dans **tous** les fichiers déplacés de `tiled/`, remplacer les imports `"./map-object.types"` → `"./map.types"` et `"./tiled.type"` → `"./tiled.types"` (grep pour les trouver). Les imports frères qui étaient `"./TileSet"`, `"./Layer"`, etc. restent valides (fichiers désormais frères dans `tiled/`).
- `tiled/tiled.types.ts` : corriger la typo `tileidth` → `tilewidth` dans le type `TiledMap`.
- `tiled/LayerManager.ts` : supprimer la méthode `addLayer` (morte).
- `tiled/MapLoader.ts` :
  - imports depuis `"./map-object"` → `"."` (le barrel `tiled/index.ts`) **ou** imports frères directs ; remplacer `from "./map-object"` par `from "."`.
  - ajouter le type de retour explicite à `getSerializedLayer` : `public getSerializedLayer(layerName: string): SerializedTile[] {`.

- [ ] **Step 8 : Corriger les imports côté consommateurs**

- `EcsScene.ts` : `import { MapLoader } from "./map-loader";` → `import { MapLoader } from "./tiled";` ; `import type { PinObject } from "./map-loader/map-object";` → `import type { PinObject } from "./tiled";`.
- `scripts/MapBuilderScript.ts` : `import type { MapLoader } from "../map-loader";` → `"../tiled"` ; `import type { SerializedTile } from "../map-loader/map-object";` → `"../tiled"`.

- [ ] **Step 9 : Lancer les tests — ils passent**

```bash
pnpm --filter dino-brawl test
```
Expected: PASS (getId + isIdIn + dimensions).

- [ ] **Step 10 : Build + lint**

```bash
pnpm --filter dino-brawl build && pnpm --filter dino-brawl lint
```
Expected: PASS.

- [ ] **Step 11 : Vérification navigateur (gate map identique)**

Protocole navigateur. **La map (ground + props) doit être pixel-identique à la référence.** Si un tile diffère, s'arrêter et rapporter (voir note Step 5).

- [ ] **Step 12 : Commit**

```bash
git add -A
git commit -m "refactor(dino-brawl): flatten map-loader into tiled/, fix TileSet defects with characterization test"
```

---

## Task 5 : Supprimer le code mort + renommer les scripts

**Files:**
- Delete: `apps/dino-brawl/src/game/scripts/WallScript.ts`
- Rename: `scripts/CameraScript.ts` → `scripts/CameraFollowScript.ts` (classe `CameraScript` → `CameraFollowScript`)
- Rename: `scripts/MapBuilderScript.ts` → `scripts/TileMapBuilderScript.ts` (classe `MapBuilderScript` → `TileMapBuilderScript`)
- Modify: `scripts/SwordScript.ts` (retirer la prop `sprite`)
- Modify: `scripts/index.ts`, `EcsScene.ts` (refs)

**Interfaces:**
- Consumes: rien de nouveau.
- Produces: `CameraFollowScript`, `TileMapBuilderScript` (mêmes comportements, noms alignés sur leur rôle) ; `SwordScript` sans la prop `sprite`.

- [ ] **Step 1 : Supprimer `WallScript`**

```bash
git rm apps/dino-brawl/src/game/scripts/WallScript.ts
```
(Jamais attaché à une entité — grep `WallScript` ne le trouve que dans sa propre définition et le barrel.)

- [ ] **Step 2 : Renommer `CameraScript` → `CameraFollowScript`**

```bash
git mv apps/dino-brawl/src/game/scripts/CameraScript.ts apps/dino-brawl/src/game/scripts/CameraFollowScript.ts
```
Dans le fichier : renommer la classe `CameraScript` → `CameraFollowScript` et l'appel `registerScriptMetadata(CameraScript, ...)` → `registerScriptMetadata(CameraFollowScript, ...)`.

- [ ] **Step 3 : Renommer `MapBuilderScript` → `TileMapBuilderScript`**

```bash
git mv apps/dino-brawl/src/game/scripts/MapBuilderScript.ts apps/dino-brawl/src/game/scripts/TileMapBuilderScript.ts
```
Dans le fichier : renommer la classe `MapBuilderScript` → `TileMapBuilderScript` et l'appel `registerScriptMetadata(...)` correspondant.

- [ ] **Step 4 : Retirer la prop morte `sprite` de `SwordScript`**

Dans `scripts/SwordScript.ts` :
- Retirer `sprite: Sprite;` du paramètre générique `AtlasScript<{ ... }>`.
- Retirer `sprite` de l'objet `registerScriptMetadata(SwordScript, { exposed: { ... } })`.
- Retirer l'import `Sprite` de `@atlasjs/gameplay` s'il n'est plus utilisé ailleurs dans le fichier (il ne l'est pas).

- [ ] **Step 5 : Mettre à jour le barrel + la scène**

`scripts/index.ts` — nouveau contenu :

```ts
export * from "./CameraFollowScript";
export * from "./CameraZoomScript";
export * from "./TileMapBuilderScript";
export * from "./PlayerMovementScript";
export * from "./PlayerScript";
export * from "./SwordScript";
```

Dans `EcsScene.ts` :
- import : `CameraScript` → `CameraFollowScript`, `MapBuilderScript` → `TileMapBuilderScript`.
- `scriptManager.attach(cameraEntity, CameraScript, {...})` → `CameraFollowScript`.
- `scriptManager.attach(ground, MapBuilderScript, {...})` / `props` → `TileMapBuilderScript`.
- retirer `sprite: swordSprite,` de l'objet passé à `scriptManager.attach(sword, SwordScript, {...})`.

- [ ] **Step 6 : Build + lint + test**

```bash
pnpm --filter dino-brawl build && pnpm --filter dino-brawl lint && pnpm --filter dino-brawl test
```
Expected: PASS.

- [ ] **Step 7 : Vérification navigateur**

Protocole navigateur. Caméra suit le joueur, zoom molette OK, map construite, épée orbite/lance — screenshot identique.

- [ ] **Step 8 : Commit**

```bash
git add -A
git commit -m "refactor(dino-brawl): remove dead WallScript + sword sprite prop, rename camera/mapbuilder scripts"
```

---

## Task 6 : Extraire les fonctions de spawn, amincir la scène (`EcsScene` → `ArenaScene`)

Comportement strictement préservé : on **déplace** la création d'entités depuis `EcsScene` vers des fonctions `spawn*` locales, sans changer ce qui est créé. Les setups statiques restent pour l'instant là où ils sont (scène + `PlayerScript`) ; ils seront déplacés en Task 7.

**Files:**
- Rename: `game/EcsScene.ts` → `game/ArenaScene.ts` (classe `EcsScene` → `ArenaScene`)
- Create: `game/spawn/index.ts`
- Create: `game/spawn/spawnWorld.ts`
- Create: `game/spawn/spawnPlayer.ts`
- Create: `game/spawn/spawnSword.ts`
- Create: `game/spawn/spawnCamera.ts`
- Create: `game/spawn/spawnProps.ts`
- Modify: `game/index.ts` (exporte `ArenaScene`)
- Modify: `app/GameCanvas.tsx` (`EcsScene` → `ArenaScene`)

**Interfaces:**
- Consumes: `SceneContext` (`ctx.services.get(TOKEN)` : `NEXUS`, `ASSET_MANAGER`, `SCRIPT_MANAGER`, `CAMERA_MANAGER`), `config.ts`, `controls.ts`, `tiled/MapLoader`.
- Produces (signatures exactes) :
  - `spawnWorld(ctx: SceneContext, mapLoader: MapLoader): Promise<void>` — crée grid + tilemaps ground/props, attache les `TileMapBuilderScript`.
  - `spawnPlayer(ctx: SceneContext, spawnPosition: Vec2): Promise<{ player: Entity; shadow: Entity }>`.
  - `spawnSword(ctx: SceneContext, owner: Entity): Promise<void>`.
  - `spawnProps(ctx: SceneContext, spawnPosition: Vec2): Promise<void>`.
  - `spawnCamera(ctx: SceneContext, target: Entity): Entity`.

- [ ] **Step 1 : `spawnWorld.ts`**

Déplacer le corps de l'actuel `loadMap` dans une fonction. Contenu :

```ts
import { Vec2 } from "@atlasjs/math";
import type { SceneContext } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";
import { type AssetManager, ASSET_MANAGER } from "@atlasjs/assets";

import {
  type ScriptManager,
  Grid,
  SCRIPT_MANAGER,
  TileMap,
  TileMapRenderer,
  TileSet,
  TileSetAsset,
  Transform2D,
} from "@atlasjs/gameplay";

import type { MapLoader } from "../tiled";
import { ResourcesPath } from "../ResourcesPath";
import { SortingLayer, MAP_SCALE } from "../config";
import { TileMapBuilderScript } from "../scripts";

export async function spawnWorld(
  ctx: SceneContext,
  mapLoader: MapLoader,
): Promise<void> {
  const nexus: NexusWorld = ctx.services.get(NEXUS);
  const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
  const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);

  const groundTileSetAsset: TileSetAsset = TileSetAsset.fromPath(
    ResourcesPath.Tilesets.Ground.Grass,
    { tileHeight: 32, tileWidth: 32 },
  );

  const propsTileSetAsset: TileSetAsset = TileSetAsset.fromPath(
    ResourcesPath.Tilesets.Props.Default,
    { tileHeight: 32, tileWidth: 32 },
  );

  const groundTileSet: TileSet = await assets.load<TileSet>(groundTileSetAsset);
  const propsTileSet: TileSet = await assets.load<TileSet>(propsTileSetAsset);

  const gridEntity: Entity = nexus.createEntity();
  nexus.addComponent(gridEntity, Transform2D);
  nexus.addComponent(gridEntity, Grid, new Vec2(32, 32));

  const ground: Entity = nexus.createEntity();
  nexus.addComponent(ground, Transform2D);
  nexus.addComponent(ground, TileMapRenderer).sortingLayer = SortingLayer.Ground;
  nexus.addComponent(ground, TileMap, groundTileSet);

  const props: Entity = nexus.createEntity();
  nexus.addComponent(props, Transform2D);
  nexus.addComponent(props, TileMapRenderer).sortingLayer = SortingLayer.Ground;
  nexus.addComponent(props, TileMap, propsTileSet);

  nexus.setParent(ground, gridEntity);
  nexus.setParent(props, gridEntity);

  scriptManager.attach(ground, TileMapBuilderScript, {
    tilesetName: "ground_layer",
    grid: gridEntity,
    scale: MAP_SCALE,
    loader: mapLoader,
  });

  scriptManager.attach(props, TileMapBuilderScript, {
    tilesetName: "props_layer",
    grid: gridEntity,
    scale: MAP_SCALE,
    loader: mapLoader,
  });
}
```

- [ ] **Step 2 : `spawnPlayer.ts`**

Déplacer la création player + shadow + animator + input + collider de `initializePlayer`. Les setups statiques (scale/position/sortingOrder/ombre) **restent dans `PlayerScript`** à ce stade (Task 7 les déplacera ici). Le sprite chargé est renommé `dinoSprite`/`dinoTexture` (l'asset est le dino **jaune**, pas bleu).

```ts
import { Vec2 } from "@atlasjs/math";
import type { SceneContext } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";
import { type AssetManager, ASSET_MANAGER } from "@atlasjs/assets";

import {
  type ColliderShapeDesc,
  type ScriptManager,
  type Sprite,
  Animator,
  Collider2D,
  PlayerInput,
  RigidBody,
  SCRIPT_MANAGER,
  SpriteRenderer,
  Transform2D,
} from "@atlasjs/gameplay";

import {
  type Texture2D,
  SpriteAnimation,
  SpriteSheet,
  TextureAsset,
} from "@atlasjs/nebula";

import { ResourcesPath } from "../ResourcesPath";
import { SortingLayer, CollisionLayers } from "../config";
import { dinoControls } from "../controls";
import { PlayerScript, PlayerMovementScript } from "../scripts";

export async function spawnPlayer(
  ctx: SceneContext,
  spawnPosition: Vec2,
): Promise<{ player: Entity; shadow: Entity }> {
  const nexus: NexusWorld = ctx.services.get(NEXUS);
  const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
  const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);

  const shadowSpriteAsset = SpriteAsset.fromPath(ResourcesPath.Sprites.Props.Shadow);
  const dinoAsset: TextureAsset = new TextureAsset(ResourcesPath.Sprites.Dinos.Yellow);
  const dinoSpriteAsset: SpriteAsset = new SpriteAsset(dinoAsset, {
    pivot: new Vec2(0.5, 1),
  });

  const dinoTexture: Texture2D = await assets.load<Texture2D>(dinoAsset);
  const dinoSprite: Sprite = await assets.load<Sprite>(dinoSpriteAsset);
  const shadowSprite: Sprite = await assets.load<Sprite>(shadowSpriteAsset);

  const playerSheet: SpriteSheet = SpriteSheet.fromAutoGrid({
    name: "player_dino",
    texture: dinoTexture,
    rows: 1,
    columns: 24,
    pivot: new Vec2(0.5, 1),
  });

  const clips: Record<string, SpriteAnimation> = {
    idle: new SpriteAnimation({
      frames: playerSheet.getManyInRange("player_dino_", 0, 3),
      fps: 5,
      loop: true,
      autoPlay: true,
    }),
    run: new SpriteAnimation({
      frames: playerSheet.getManyInRange("player_dino_", 4, 9),
      fps: 12,
      loop: true,
      autoPlay: true,
    }),
    sprint: new SpriteAnimation({
      frames: playerSheet.getManyInRange("player_dino_", 17, 23),
      fps: 12,
      loop: true,
      autoPlay: true,
    }),
  };

  const player: Entity = nexus.createEntity();
  nexus.addComponent(player, Transform2D);
  nexus.addComponent(player, RigidBody);
  nexus.addComponent(player, Animator, clips, "idle");
  nexus.addComponent(player, SpriteRenderer, dinoSprite).sortingLayer = SortingLayer.Entities;
  nexus.addComponent(player, PlayerInput, dinoControls);

  const playerCollider: Collider2D = nexus.addComponent(player, Collider2D, {
    type: "circle",
    radius: 10,
  } as ColliderShapeDesc);
  playerCollider.layer = CollisionLayers.Player;
  playerCollider.collidesWith = CollisionLayers.Occluder;

  const shadow: Entity = nexus.createEntity();
  nexus.addComponent(shadow, Transform2D);
  nexus.addComponent(shadow, SpriteRenderer, shadowSprite).sortingLayer = SortingLayer.Entities;

  nexus.setParent(shadow, player);

  scriptManager.attach(player, PlayerScript, {
    shadow: shadow,
    spawn: spawnPosition,
  });

  scriptManager.attach(player, PlayerMovementScript, {
    speed: 250,
  });

  return { player, shadow };
}
```

Note import : `SpriteAsset` vient de `@atlasjs/gameplay`. L'ajouter à l'import gameplay ci-dessus (`SpriteAsset`).

- [ ] **Step 3 : `spawnSword.ts`**

```ts
import type { SceneContext } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";
import { type AssetManager, ASSET_MANAGER } from "@atlasjs/assets";

import {
  type ScriptManager,
  type Sprite,
  SCRIPT_MANAGER,
  SpriteAsset,
  SpriteRenderer,
  Transform2D,
} from "@atlasjs/gameplay";

import { ResourcesPath } from "../ResourcesPath";
import { SortingLayer } from "../config";
import { SwordScript } from "../scripts";

export async function spawnSword(ctx: SceneContext, owner: Entity): Promise<void> {
  const nexus: NexusWorld = ctx.services.get(NEXUS);
  const assets: AssetManager = ctx.services.get(ASSET_MANAGER);
  const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);

  const swordSpriteAsset: SpriteAsset = SpriteAsset.fromPath(ResourcesPath.Sprites.Swords.Default);
  const swordSprite: Sprite = await assets.load<Sprite>(swordSpriteAsset);

  const sword: Entity = nexus.createEntity();
  nexus.addComponent(sword, Transform2D);
  nexus.addComponent(sword, SpriteRenderer, swordSprite).sortingLayer = SortingLayer.Entities;

  scriptManager.attach(sword, SwordScript, {
    scale: 1.7,
    owner: owner,
    maxPower: 500,
    orbitRadius: 45,
    throwDuration: 1,
    rotationSpeed: { max: 10 * Math.PI, min: Math.PI / 2 },
    orbitSpeed: { max: 6 * Math.PI, min: Math.PI },
  });
}
```

Note : la prop `sprite` a été retirée de `SwordScript` en Task 5 ; ne pas la passer ici. `scale`/`sortingOrder` restent appliqués par `SwordScript.onCreate` à ce stade (déplacés en Task 7).

- [ ] **Step 4 : `spawnProps.ts`**

```ts
import { Vec2 } from "@atlasjs/math";
import type { SceneContext } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";
import { type AssetManager, ASSET_MANAGER } from "@atlasjs/assets";

import {
  type ColliderShapeDesc,
  type Sprite,
  Collider2D,
  SpriteAsset,
  SpriteRenderer,
  Transform2D,
} from "@atlasjs/gameplay";

import { ResourcesPath } from "../ResourcesPath";
import { SortingLayer, CollisionLayers } from "../config";

export async function spawnProps(ctx: SceneContext, spawnPosition: Vec2): Promise<void> {
  const nexus: NexusWorld = ctx.services.get(NEXUS);
  const assets: AssetManager = ctx.services.get(ASSET_MANAGER);

  const treeAsset: SpriteAsset = SpriteAsset.fromPath(ResourcesPath.Tilesets.Player.Tree1, {
    pivot: new Vec2(0.5, 0.95),
  });
  const treeSprite: Sprite = await assets.load<Sprite>(treeAsset);

  const treePositions: Vec2[] = [
    new Vec2(spawnPosition.x - 110, spawnPosition.y - 48),
    new Vec2(spawnPosition.x + 110, spawnPosition.y + 48),
  ];

  for (const treePosition of treePositions) {
    const tree: Entity = nexus.createEntity();
    const treeTransform: Transform2D = nexus.addComponent(tree, Transform2D);
    treeTransform.position = treePosition;
    nexus.addComponent(tree, SpriteRenderer, treeSprite).sortingLayer = SortingLayer.Entities;

    const treeCollider: Collider2D = nexus.addComponent(tree, Collider2D, {
      type: "box",
      width: 24,
      height: 24,
    } as ColliderShapeDesc);
    treeCollider.layer = CollisionLayers.Occluder;
    treeCollider.collidesWith = CollisionLayers.Player;
  }
}
```

- [ ] **Step 5 : `spawnCamera.ts`**

```ts
import type { SceneContext } from "@atlasjs/core";
import { type Entity, type NexusWorld, NEXUS } from "@atlasjs/nexus";

import {
  type CameraManager,
  type ScriptManager,
  CAMERA_MANAGER,
  Camera,
  SCRIPT_MANAGER,
  Transform2D,
} from "@atlasjs/gameplay";

import { CameraFollowScript, CameraZoomScript } from "../scripts";

export function spawnCamera(ctx: SceneContext, target: Entity): Entity {
  const nexus: NexusWorld = ctx.services.get(NEXUS);
  const scriptManager: ScriptManager = ctx.services.get(SCRIPT_MANAGER);
  const cameraManager: CameraManager = ctx.services.get(CAMERA_MANAGER);

  const cameraEntity: Entity = nexus.createEntity();
  nexus.addComponent(cameraEntity, Camera);
  nexus.addComponent(cameraEntity, Transform2D);

  scriptManager.attach(cameraEntity, CameraFollowScript, { target: target });
  scriptManager.attach(cameraEntity, CameraZoomScript, {});

  cameraManager.setActive(cameraEntity);

  return cameraEntity;
}
```

- [ ] **Step 6 : Barrel `spawn/index.ts`**

```ts
export * from "./spawnCamera";
export * from "./spawnPlayer";
export * from "./spawnProps";
export * from "./spawnSword";
export * from "./spawnWorld";
```

- [ ] **Step 7 : Réécrire la scène `ArenaScene.ts`**

```bash
git mv apps/dino-brawl/src/game/EcsScene.ts apps/dino-brawl/src/game/ArenaScene.ts
```

Contenu de `ArenaScene.ts` :

```ts
import { Vec2 } from "@atlasjs/math";
import { type SceneContext, Scene } from "@atlasjs/core";

import {
  type SortingLayers,
  SORTING_LAYERS,
} from "@atlasjs/gameplay";

import type { PinObject } from "./tiled";
import { MapLoader } from "./tiled";
import { ResourcesPath } from "./ResourcesPath";
import { SortingLayer, MAP_SCALE } from "./config";
import {
  spawnCamera,
  spawnPlayer,
  spawnProps,
  spawnSword,
  spawnWorld,
} from "./spawn";

export class ArenaScene extends Scene {
  private fpsCallback: (fps: number) => void;

  public constructor(cb: (fps: number) => void) {
    super("game-scene");
    this.fpsCallback = cb;
  }

  public override async onCreate(ctx: SceneContext): Promise<void> {
    const sortingLayers: SortingLayers = ctx.services.get(SORTING_LAYERS);
    sortingLayers.define([
      { name: SortingLayer.Ground, mode: "manual" },
      { name: SortingLayer.Entities, mode: "ySorted" },
      { name: SortingLayer.Overhead, mode: "manual" },
    ]);

    const mapLoader: MapLoader = new MapLoader(ResourcesPath.Map);
    await spawnWorld(ctx, mapLoader);

    const spawn: PinObject | undefined = mapLoader.getObject<PinObject>("spawn_point");
    const spawnPosition: Vec2 = spawn
      ? Vec2.create(spawn.x, spawn.y).mult(MAP_SCALE)
      : Vec2.zero();

    const { player } = await spawnPlayer(ctx, spawnPosition);
    await spawnSword(ctx, player);
    await spawnProps(ctx, spawnPosition);
    spawnCamera(ctx, player);
  }

  public onUpdate(dt: number): void {
    this.fpsCallback(1 / dt);
  }
}
```

Note ordre : la référence originale créait le player, l'épée (owner=player), la caméra, l'ombre (enfant du player), les arbres, puis attachait les scripts. Ici `spawnPlayer` crée déjà l'ombre en enfant et attache `PlayerScript`/`PlayerMovementScript` ; l'ordre relatif player → sword → props → camera préserve les dépendances (`SwordScript`/`CameraFollowScript` lisent le `Transform` du player, présent dès `spawnPlayer`).

- [ ] **Step 8 : `game/index.ts` + `GameCanvas.tsx`**

`game/index.ts` : `export * from "./EcsScene";` → `export * from "./ArenaScene";`.

`app/GameCanvas.tsx` : `import { EcsScene } from "../game";` → `import { ArenaScene } from "../game";` et `engine.scene.set(new EcsScene(cb));` → `engine.scene.set(new ArenaScene(cb));`.

- [ ] **Step 9 : Build + lint + test**

```bash
pnpm --filter dino-brawl build && pnpm --filter dino-brawl lint && pnpm --filter dino-brawl test
```
Expected: PASS.

- [ ] **Step 10 : Vérification navigateur (gate complet)**

Protocole navigateur. Tout identique : map, dino (échelle 3, spawn, anims idle/run/sprint, flipX), ombre placée/teintée, épée orbite/lance, caméra suit + zoom, arbres Y-triés. Screenshot identique à la référence.

- [ ] **Step 11 : Commit**

```bash
git add -A
git commit -m "refactor(dino-brawl): extract spawn functions, slim EcsScene into ArenaScene"
```

---

## Task 7 : Déplacer la config statique dans les spawns ; scinder le script joueur par responsabilité

Application du principe directeur : les setups statiques quittent les scripts. `PlayerScript` (setup + animation) devient `PlayerAnimationScript` (animation seule) ; son setup monte dans `spawnPlayer`. Idem pour l'échelle/sortingOrder de l'épée → `spawnSword`.

**Files:**
- Rename: `scripts/PlayerScript.ts` → `scripts/PlayerAnimationScript.ts` (classe `PlayerScript` → `PlayerAnimationScript`)
- Modify: `scripts/SwordScript.ts` (retirer `scale` + `setScale`/`sortingOrder` de `onCreate`)
- Modify: `spawn/spawnPlayer.ts` (absorbe le setup statique + attache `PlayerAnimationScript`)
- Modify: `spawn/spawnSword.ts` (applique `scale` + `sortingOrder`)
- Modify: `scripts/index.ts`

**Interfaces:**
- Consumes: `SortingOrder` depuis `config.ts`.
- Produces:
  - `PlayerAnimationScript extends AtlasScript` (aucune prop) — `onCreate` récupère `Animator` + `SpriteRenderer` + actions `move`/`boost` ; `onUpdate` sélectionne le clip + `flipX`. **Aucun** setup statique.
  - `SwordScript` sans prop `scale` ; `onCreate` ne fait plus `setScale`/`sortingOrder`.
  - `spawnPlayer` applique : player `scale (3,3)`, `position = spawn`, `sortingOrder = SortingOrder.Player` ; shadow `sortingOrder = SortingOrder.Shadow`, `color rgba(1,1,1,0.4)`, `scale (0.7,0.6)`, `position (-0.5,-3)`.
  - `spawnSword` applique : `scale (1.7,1.7)`, `sortingOrder = SortingOrder.Sword`.

- [ ] **Step 1 : Renommer + réduire le script joueur à l'animation**

```bash
git mv apps/dino-brawl/src/game/scripts/PlayerScript.ts apps/dino-brawl/src/game/scripts/PlayerAnimationScript.ts
```

Nouveau contenu de `PlayerAnimationScript.ts` (setup statique retiré ; plus de props `shadow`/`spawn` ; plus de `registerScriptMetadata`) :

```ts
import type { Vec2 } from "@atlasjs/math";

import {
  Animator,
  AtlasScript,
  ButtonAction,
  PlayerInput,
  SpriteRenderer,
  Vector2Action,
} from "@atlasjs/gameplay";

import type { DinoControls } from "../controls";

export class PlayerAnimationScript extends AtlasScript {
  private animator: Animator;
  private spriteRenderer: SpriteRenderer;

  private move: Vector2Action;
  private boost: ButtonAction;

  public onCreate(): void {
    const actions: PlayerInput<DinoControls> = this.requireComponent(PlayerInput);

    this.animator = this.requireComponent(Animator);
    this.spriteRenderer = this.requireComponent(SpriteRenderer);

    this.move = actions.get("move");
    this.boost = actions.get("boost");
  }

  public onUpdate(): void {
    const v: Vec2 = this.move.readValue();

    if (v.x !== 0 || v.y !== 0) {
      const animation: string = this.boost.isDown() ? "sprint" : "run";
      this.animator.play(animation);
    } else {
      this.animator.play("idle");
    }

    if (v.x !== 0) {
      this.spriteRenderer.flipX = v.x < 0;
    }
  }
}
```

- [ ] **Step 2 : Retirer le setup statique de `SwordScript`**

Dans `scripts/SwordScript.ts` :
- Retirer `scale: number;` du paramètre générique `AtlasScript<{ ... }>` et le champ `private readonly scale: number;`.
- Retirer `scale` de `registerScriptMetadata(SwordScript, { exposed: { ... } })`.
- Dans `onCreate`, supprimer les lignes `this.transform.setScale(this.scale, this.scale);` et `this.spriteRenderer.sortingOrder = 20;`.

- [ ] **Step 3 : `spawnPlayer` absorbe le setup statique**

Dans `spawn/spawnPlayer.ts` :
- Import : `SortingOrder` depuis `../config` ; `Color` depuis `@atlasjs/gameplay` ; remplacer `PlayerScript` par `PlayerAnimationScript` dans l'import `../scripts`.
- Sur le player, après l'ajout des composants :
```ts
const playerTransform: Transform2D = nexus.getComponent(player, Transform2D)!;
playerTransform.scale.set(3, 3);
playerTransform.position.copyFrom(spawnPosition);
```
  (ou récupérer la référence retournée par `addComponent(player, Transform2D)` en la stockant dans une variable `playerTransform` au moment de la création plutôt que via `getComponent` — préférer stocker à la création.)
- Sur le `SpriteRenderer` du player : `.sortingOrder = SortingOrder.Player;` (le récupérer via la variable retournée par `addComponent`).
- Sur l'ombre :
```ts
const shadowTransform: Transform2D = nexus.addComponent(shadow, Transform2D);
const shadowRender: SpriteRenderer = nexus.addComponent(shadow, SpriteRenderer, shadowSprite);
shadowRender.sortingLayer = SortingLayer.Entities;
shadowRender.sortingOrder = SortingOrder.Shadow;
shadowRender.color = new Color(1, 1, 1, 0.4);
shadowTransform.scale.set(0.7, 0.6);
shadowTransform.position.set(-0.5, -3);
```
- Remplacer l'attache `scriptManager.attach(player, PlayerScript, { shadow, spawn })` par `scriptManager.attach(player, PlayerAnimationScript, {});`.

Structure finale de la partie composition de `spawnPlayer` (référence complète) :

```ts
const player: Entity = nexus.createEntity();
const playerTransform: Transform2D = nexus.addComponent(player, Transform2D);
nexus.addComponent(player, RigidBody);
nexus.addComponent(player, Animator, clips, "idle");
const playerRender: SpriteRenderer = nexus.addComponent(player, SpriteRenderer, dinoSprite);
nexus.addComponent(player, PlayerInput, dinoControls);

playerRender.sortingLayer = SortingLayer.Entities;
playerRender.sortingOrder = SortingOrder.Player;
playerTransform.scale.set(3, 3);
playerTransform.position.copyFrom(spawnPosition);

const playerCollider: Collider2D = nexus.addComponent(player, Collider2D, {
  type: "circle",
  radius: 10,
} as ColliderShapeDesc);
playerCollider.layer = CollisionLayers.Player;
playerCollider.collidesWith = CollisionLayers.Occluder;

const shadow: Entity = nexus.createEntity();
const shadowTransform: Transform2D = nexus.addComponent(shadow, Transform2D);
const shadowRender: SpriteRenderer = nexus.addComponent(shadow, SpriteRenderer, shadowSprite);
shadowRender.sortingLayer = SortingLayer.Entities;
shadowRender.sortingOrder = SortingOrder.Shadow;
shadowRender.color = new Color(1, 1, 1, 0.4);
shadowTransform.scale.set(0.7, 0.6);
shadowTransform.position.set(-0.5, -3);

nexus.setParent(shadow, player);

scriptManager.attach(player, PlayerAnimationScript, {});
scriptManager.attach(player, PlayerMovementScript, { speed: 250 });
```

Note comportement : l'ancien `PlayerScript.onCreate` utilisait la façade `Transform` (`setScale`/`position.copyFrom`) ; le player est un corps **kinematic**, dont l'autorité est le transform (pas la physique), donc écrire directement `Transform2D.scale`/`position` est équivalent. L'ombre n'a pas de `RigidBody` → transform pur. Aucun changement visuel attendu ; le gate est la vérif navigateur.

- [ ] **Step 4 : `spawnSword` applique scale + sortingOrder**

Dans `spawn/spawnSword.ts` :
- Import `SortingOrder` depuis `../config` (à ajouter à l'import config existant : `import { SortingLayer, SortingOrder } from "../config";`).
- Stocker la référence Transform2D + SpriteRenderer et les configurer :
```ts
const sword: Entity = nexus.createEntity();
const swordTransform: Transform2D = nexus.addComponent(sword, Transform2D);
const swordRender: SpriteRenderer = nexus.addComponent(sword, SpriteRenderer, swordSprite);
swordRender.sortingLayer = SortingLayer.Entities;
swordRender.sortingOrder = SortingOrder.Sword;
swordTransform.scale.set(1.7, 1.7);
```
- Retirer `scale: 1.7,` de l'objet passé à `scriptManager.attach(sword, SwordScript, { ... })`.

Note : `SwordScript.onCreate` re-appelle `this.transform.setScale`/`setRotation` chaque frame via la façade dans `tickOrbit`/`tickThrown` — le scale initial (1.7) doit être posé avant, ce que fait `spawnSword`. `SwordScript` ne touche plus au scale ni au sortingOrder.

- [ ] **Step 5 : Barrel `scripts/index.ts`**

```ts
export * from "./CameraFollowScript";
export * from "./CameraZoomScript";
export * from "./TileMapBuilderScript";
export * from "./PlayerAnimationScript";
export * from "./PlayerMovementScript";
export * from "./SwordScript";
```

- [ ] **Step 6 : Build + lint + test**

```bash
pnpm --filter dino-brawl build && pnpm --filter dino-brawl lint && pnpm --filter dino-brawl test
```
Expected: PASS. (Vérifier qu'aucun import de `PlayerScript`/`Color`/`ScriptMetadata` résiduel ne subsiste ; `noUnusedLocals` le signalerait.)

- [ ] **Step 7 : Vérification navigateur (gate final)**

Protocole navigateur. Comparaison stricte à la référence du Task 1 Step 1 :
- dino à l'échelle 3, au spawn, anims idle/run/sprint + flipX ;
- ombre : teinte 40%, échelle (0.7,0.6), offset (-0.5,-3), sous le dino ;
- épée : échelle 1.7, orbite + charge + lancer identiques ;
- tri Y global identique.

Screenshot final == référence.

- [ ] **Step 8 : Commit**

```bash
git add -A
git commit -m "refactor(dino-brawl): move static setup into spawn fns, split PlayerScript into PlayerAnimationScript"
```

---

## Self-Review (rempli à l'écriture du plan)

**Couverture spec :**
- §3 Renommage → Task 1. ✅
- §4.1 app/ split → Task 3. ✅ §4.2 spawn fns → Task 6. ✅
- §5 config.ts → Task 2. ✅
- §6.1 re-split joueur → Task 7 (+ dédup type Task 2). ✅ §6.2 sword → Task 5 (prop `sprite`) + Task 7 (scale/order). ✅ §6.3 renames → Task 5. ✅ §6.4 controls + drop hello → Task 2. ✅
- §7 tiled/ → Task 4 (tous les défauts : tileWidth/Height, firstGid, type retour, typo, addLayer, Layer mort, renames). ✅
- §8 code mort → WallScript/hello/sword sprite (Task 2/5), Window (Task 3), blueDino misnomer (Task 6). ✅ **Ajusté :** les `.DS_Store` ne sont **pas** trackés (`git ls-files` vide) et `.gitignore` contient déjà la règle → aucune action requise (l'item spec §8 devient sans objet). Sprites d'épées + dinos conservés. ✅
- §9 vérification → protocole navigateur + build/lint/test à chaque tâche. ✅

**Placeholders :** aucun TBD/TODO ; tout le code des fichiers créés/réécrits est fourni ; les renames donnent commandes + éditions exactes.

**Cohérence des types :** `DinoControls = (typeof dinoControls)["specs"]` (Task 2) utilisé identiquement dans `PlayerMovementScript`/`PlayerAnimationScript`. `spawn*` signatures définies en Task 6 §Interfaces et consommées telles quelles par `ArenaScene`. `SortingOrder`/`SortingLayer`/`CollisionLayers`/`MAP_SCALE` (Task 2) référencés de façon cohérente ensuite. `TileSet` API (`getId`/`isIdIn`/`tileWidth`) cohérente entre test (Task 4 Step 3) et impl (Step 5).

**Note de risque unique :** la correction des bornes de `TileSet.isIdIn` (Task 4) est la seule modification pouvant théoriquement altérer le rendu ; gate explicite « stop & report si la map diffère ».
