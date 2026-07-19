# Caméra gameplay + screen↔world — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une caméra gameplay (entité Nexus) qui pilote la caméra de rendu de nebula, plus `screenToWorld`/`worldToScreen`, avec une caméra active unique (« main ») switchable.

**Architecture:** Un composant `Camera` (LEVEL 1, données pures : `zoom`) + un `CameraManager` (service, autorité de la caméra active + du screen↔world) + un `CameraSyncSystem` (lane `render`, pousse la position monde + zoom de la caméra active dans `renderer.camera`, en bakant le centrage Unity-like dans la matrice) + une façade `CameraApi` (accès script). nebula reste mono-caméra (une passe) ; on ajoute juste `screenToWorld`/`worldToScreen` sur `Camera2D` et un passthrough `getCameraViewport()` sur `NebulaRenderer`.

**Tech Stack:** TypeScript, monorepo pnpm/Turborepo, vitest (TDD), packages `@atlasjs/nebula`, `@atlasjs/nexus`, `@atlasjs/gameplay`, `@atlasjs/math`, `@atlasjs/core`.

**Spec source:** [`docs/gameplay/camera.md`](camera.md).

## Global Constraints

- **Toujours typer** le code (params, variables, champs de classe) — y compris les types triviaux. (CLAUDE.md)
- **Pas de commentaires** ajoutés dans le code. (CLAUDE.md)
- **Pas de dépendances circulaires.** `camera/` ne dépend **jamais** de `scripting/` ni de `systems/`. (CLAUDE.md)
- **nebula reste backend-agnostic** : aucun import WebGPU/WGSL. (nebula CLAUDE.md)
- **Typecheck gameplay via `tsc --noEmit`**, jamais `tsc -b` (émet des artefacts à côté des sources). (gameplay CLAUDE.md)
- **Rebuild le `dist` d'une dépendance dont l'API publique change** avant de typechecker/preview les consommateurs. (gameplay CLAUDE.md)
- **Systèmes retirables** : garder le `StepHandle`/`Unsubscribe` et défaire à l'`uninstall`. (core CLAUDE.md)
- Tests unitaires de systèmes : construire un `NexusWorld` standalone + un fake `NebulaRenderer` casté (pattern `sprite-render-system.test.ts`).

## État d'avancement

| Task | Statut |
| --- | --- |
| 1. `Camera2D.screenToWorld`/`worldToScreen` | ✅ implémenté + review clean (attente commit user) |
| 2. `NebulaRenderer.getCameraViewport` passthrough | ✅ implémenté + review clean (attente commit user) |
| 3. Composant `Camera` (LEVEL 1) | ✅ implémenté + review clean (attente commit user) |
| 4. `CameraManager` + token | ✅ implémenté + review clean (attente commit user) |
| 5. `CameraSyncSystem` | ✅ implémenté + review clean (attente commit user) |
| 6. `CameraApi` | ✅ implémenté + review clean (attente commit user) |
| 7. Câblage `GameplayPlugin` | ✅ implémenté + review clean (attente commit user) — inclut un fix d'ordre dans CameraSyncSystem |
| 8. Démo sandbox (opt.) | ⏳ à faire |

---

### Task 1: `Camera2D.screenToWorld` / `worldToScreen` (nebula) — ✅ DONE

**Files:**
- Modify: `packages/nebula/src/core/camera/Camera2D.ts`
- Test: `packages/nebula/test/Camera2D.test.ts` (ajouter des cas)

**Interfaces:**
- Produces:
  - `Camera2D.screenToWorld(screen: Vec2, out?: Vec2): Vec2` — `out = position + screen / zoom`
  - `Camera2D.worldToScreen(world: Vec2, out?: Vec2): Vec2` — `out = (world - position) * zoom`

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter dans `packages/nebula/test/Camera2D.test.ts` (le fichier existe déjà, `Vec2` déjà importé) :

```ts
describe("Camera2D.screenToWorld / worldToScreen", () => {
  it("screenToWorld maps the screen origin to the camera position", () => {
    const camera: Camera2D = new Camera2D();
    camera.setPosition(100, 50).setZoom(2);

    const world: Vec2 = camera.screenToWorld(new Vec2(0, 0));

    expect(world.x).toBeCloseTo(100);
    expect(world.y).toBeCloseTo(50);
  });

  it("screenToWorld divides the screen offset by the zoom", () => {
    const camera: Camera2D = new Camera2D();
    camera.setPosition(100, 50).setZoom(2);

    const world: Vec2 = camera.screenToWorld(new Vec2(800, 600));

    expect(world.x).toBeCloseTo(100 + 400);
    expect(world.y).toBeCloseTo(50 + 300);
  });

  it("worldToScreen is the inverse of screenToWorld", () => {
    const camera: Camera2D = new Camera2D();
    camera.setPosition(-30, 12).setZoom(3);

    const screen: Vec2 = camera.worldToScreen(new Vec2(70, 42));
    const roundTrip: Vec2 = camera.screenToWorld(screen);

    expect(roundTrip.x).toBeCloseTo(70);
    expect(roundTrip.y).toBeCloseTo(42);
  });

  it("writes into the provided out vector", () => {
    const camera: Camera2D = new Camera2D();
    camera.setPosition(0, 0).setZoom(1);
    const out: Vec2 = new Vec2();

    const result: Vec2 = camera.screenToWorld(new Vec2(5, 9), out);

    expect(result).toBe(out);
    expect(out.x).toBeCloseTo(5);
    expect(out.y).toBeCloseTo(9);
  });
});
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run: `pnpm --filter @atlasjs/nebula test -- Camera2D`
Expected: FAIL — `camera.screenToWorld is not a function`.

- [ ] **Step 3 : Implémenter les deux méthodes**

Dans `packages/nebula/src/core/camera/Camera2D.ts` (`Vec2` est déjà importé), ajouter les méthodes dans la classe, par ex. après `update` :

```ts
  public screenToWorld(screen: Vec2, out: Vec2 = new Vec2()): Vec2 {
    return out.set(
      this.position.x + screen.x / this.zoom,
      this.position.y + screen.y / this.zoom,
    );
  }

  public worldToScreen(world: Vec2, out: Vec2 = new Vec2()): Vec2 {
    return out.set(
      (world.x - this.position.x) * this.zoom,
      (world.y - this.position.y) * this.zoom,
    );
  }
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `pnpm --filter @atlasjs/nebula test -- Camera2D`
Expected: PASS (les nouveaux cas + le cas `update` existant).

- [ ] **Step 5 : Commit**

```bash
git add packages/nebula/src/core/camera/Camera2D.ts packages/nebula/test/Camera2D.test.ts
git commit -m "feat(nebula): Camera2D.screenToWorld / worldToScreen"
```

---

### Task 2: `NebulaRenderer.getCameraViewport()` passthrough + rebuild dist (nebula) — ✅ DONE

**Files:**
- Modify: `packages/nebula/src/NebulaRenderer.ts`
- Test: `packages/nebula/test/NebulaRenderer.test.ts` (ajouter un cas)

**Interfaces:**
- Consumes: `Renderer.getCameraViewport(): Bound` (contrat existant, `packages/nebula/src/core/renderer/Renderer.ts:20`).
- Produces: `NebulaRenderer.getCameraViewport(): Bound` (passthrough).

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter dans `packages/nebula/test/NebulaRenderer.test.ts` :

```ts
import { Bound } from "@atlasjs/math";

describe("NebulaRenderer.getCameraViewport", () => {
  it("forwards the camera viewport from the underlying renderer", () => {
    const viewport: Bound = Bound.create(10, 20, 400, 300);
    const renderer: Renderer = {
      getCameraViewport(): Bound {
        return viewport;
      },
    } as unknown as Renderer;

    const nebula: NebulaRenderer = new NebulaRenderer(renderer);

    expect(nebula.getCameraViewport()).toBe(viewport);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `pnpm --filter @atlasjs/nebula test -- NebulaRenderer`
Expected: FAIL — `nebula.getCameraViewport is not a function`.

- [ ] **Step 3 : Implémenter le passthrough**

Dans `packages/nebula/src/NebulaRenderer.ts`, ajouter l'import `Bound` en tête :

```ts
import { Bound } from "@atlasjs/math";
```

et la méthode dans la classe (par ex. juste après le getter `camera`) :

```ts
  public getCameraViewport(): Bound {
    return this.renderer.getCameraViewport();
  }
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `pnpm --filter @atlasjs/nebula test -- NebulaRenderer`
Expected: PASS.

- [ ] **Step 5 : Rebuild le dist de nebula (API publique changée → consommée par gameplay)**

Run: `pnpm --filter @atlasjs/nebula build`
Expected: build OK (ESM + `.d.ts` régénérés avec `screenToWorld`/`worldToScreen`/`getCameraViewport`).

- [ ] **Step 6 : Commit**

```bash
git add packages/nebula/src/NebulaRenderer.ts packages/nebula/test/NebulaRenderer.test.ts
git commit -m "feat(nebula): expose NebulaRenderer.getCameraViewport passthrough"
```

---

### Task 3: Composant `Camera` (LEVEL 1, gameplay) — ✅ DONE

**Files:**
- Create: `packages/gameplay/src/components/Camera.ts`
- Modify: `packages/gameplay/src/components/index.ts`
- Test: `packages/gameplay/test/camera-component.test.ts`

**Interfaces:**
- Produces: `class Camera { zoom: number }` (défaut `1`).

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `packages/gameplay/test/camera-component.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { Camera } from "../src/components";

describe("Camera component", () => {
  it("defaults zoom to 1", () => {
    const camera: Camera = new Camera();
    expect(camera.zoom).toBe(1);
  });

  it("allows zoom to be set", () => {
    const camera: Camera = new Camera();
    camera.zoom = 2.5;
    expect(camera.zoom).toBe(2.5);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `pnpm --filter @atlasjs/gameplay test -- camera-component`
Expected: FAIL — `Camera` introuvable dans `../src/components`.

- [ ] **Step 3 : Créer le composant + l'export**

`packages/gameplay/src/components/Camera.ts` :

```ts
export class Camera {
  public zoom: number = 1;
}
```

Ajouter dans `packages/gameplay/src/components/index.ts` (garder l'ordre alphabétique existant, avant `PhysicsBodyRef`) :

```ts
export * from "./Camera";
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `pnpm --filter @atlasjs/gameplay test -- camera-component`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add packages/gameplay/src/components/Camera.ts packages/gameplay/src/components/index.ts packages/gameplay/test/camera-component.test.ts
git commit -m "feat(gameplay): Camera component (LEVEL 1)"
```

---

### Task 4: `CameraManager` + token `CAMERA_MANAGER` (gameplay) — ✅ DONE

**Files:**
- Create: `packages/gameplay/src/camera/CameraManager.ts`
- Create: `packages/gameplay/src/camera/tokens.ts`
- Create: `packages/gameplay/src/camera/index.ts`
- Modify: `packages/gameplay/src/index.ts`
- Test: `packages/gameplay/test/camera-manager.test.ts`

**Interfaces:**
- Consumes: `Camera2D.screenToWorld/worldToScreen` (Task 1) via `NebulaRenderer.camera`.
- Produces:
  - `class CameraManager` :
    - `constructor(renderer: NebulaRenderer)`
    - `setActive(entity: Entity | undefined): void`
    - `getActive(): Entity | undefined`
    - `screenToWorld(screen: Vec2, out?: Vec2): Vec2`
    - `worldToScreen(world: Vec2, out?: Vec2): Vec2`
  - `CAMERA_MANAGER: ServiceToken<CameraManager>`

> **Contrainte anti-cycle :** `camera/` importe uniquement `@atlasjs/{nebula,nexus,math,core}`. Il n'importe **ni** `scripting/` **ni** `systems/` **ni** le `tokens.ts` racine.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `packages/gameplay/test/camera-manager.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { Vec2 } from "@atlasjs/math";
import { Camera2D, NebulaRenderer } from "@atlasjs/nebula";
import { Entity } from "@atlasjs/nexus";

import { CameraManager } from "../src/camera";

function fakeNebula(camera: Camera2D): NebulaRenderer {
  return { camera } as unknown as NebulaRenderer;
}

describe("CameraManager", () => {
  it("tracks the active camera entity", () => {
    const manager: CameraManager = new CameraManager(fakeNebula(new Camera2D()));
    expect(manager.getActive()).toBeUndefined();

    const entity: Entity = 7 as unknown as Entity;
    manager.setActive(entity);
    expect(manager.getActive()).toBe(entity);

    manager.setActive(undefined);
    expect(manager.getActive()).toBeUndefined();
  });

  it("delegates screenToWorld to the render camera", () => {
    const camera: Camera2D = new Camera2D();
    camera.setPosition(100, 50).setZoom(2);
    const manager: CameraManager = new CameraManager(fakeNebula(camera));

    const world: Vec2 = manager.screenToWorld(new Vec2(800, 600));

    expect(world.x).toBeCloseTo(100 + 400);
    expect(world.y).toBeCloseTo(50 + 300);
  });

  it("delegates worldToScreen to the render camera", () => {
    const camera: Camera2D = new Camera2D();
    camera.setPosition(0, 0).setZoom(2);
    const manager: CameraManager = new CameraManager(fakeNebula(camera));

    const screen: Vec2 = manager.worldToScreen(new Vec2(10, 20));

    expect(screen.x).toBeCloseTo(20);
    expect(screen.y).toBeCloseTo(40);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `pnpm --filter @atlasjs/gameplay test -- camera-manager`
Expected: FAIL — `CameraManager` introuvable dans `../src/camera`.

- [ ] **Step 3 : Créer `CameraManager`, le token et le barrel**

`packages/gameplay/src/camera/CameraManager.ts` :

```ts
import { Vec2 } from "@atlasjs/math";
import { NebulaRenderer } from "@atlasjs/nebula";
import { Entity } from "@atlasjs/nexus";

export class CameraManager {
  private readonly renderer: NebulaRenderer;
  private active: Entity | undefined;

  public constructor(renderer: NebulaRenderer) {
    this.renderer = renderer;
    this.active = undefined;
  }

  public setActive(entity: Entity | undefined): void {
    this.active = entity;
  }

  public getActive(): Entity | undefined {
    return this.active;
  }

  public screenToWorld(screen: Vec2, out?: Vec2): Vec2 {
    return this.renderer.camera.screenToWorld(screen, out);
  }

  public worldToScreen(world: Vec2, out?: Vec2): Vec2 {
    return this.renderer.camera.worldToScreen(world, out);
  }
}
```

`packages/gameplay/src/camera/tokens.ts` :

```ts
import { ServiceRegistry, ServiceToken } from "@atlasjs/core";

import { CameraManager } from "./CameraManager";

export const CAMERA_MANAGER: ServiceToken<CameraManager> =
  ServiceRegistry.createToken("CAMERA_MANAGER");
```

`packages/gameplay/src/camera/index.ts` :

```ts
export * from "./CameraManager";
export * from "./tokens";
```

Ajouter dans `packages/gameplay/src/index.ts`, après la ligne `export * from "./components";` :

```ts
export * from "./camera";
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `pnpm --filter @atlasjs/gameplay test -- camera-manager`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add packages/gameplay/src/camera packages/gameplay/src/index.ts packages/gameplay/test/camera-manager.test.ts
git commit -m "feat(gameplay): CameraManager service + CAMERA_MANAGER token"
```

---

### Task 5: `CameraSyncSystem` (gameplay) — ✅ DONE

**Files:**
- Create: `packages/gameplay/src/systems/CameraSyncSystem.ts`
- Modify: `packages/gameplay/src/systems/index.ts`
- Test: `packages/gameplay/test/camera-sync-system.test.ts`

**Interfaces:**
- Consumes: `CameraManager.getActive()` (Task 4), `Camera.zoom` (Task 3), `WorldTransform2D.getPosition(out?)`, `NebulaRenderer.camera` + `NebulaRenderer.getCameraViewport()` (Task 2).
- Produces: `class CameraSyncSystem implements NexusSystem` — `constructor(manager: CameraManager, renderer: NebulaRenderer)`, `update({ world }: NexusSystemContext): void`.

> **Centrage — ordre strict :** (1) poser `camera.zoom` ; (2) lire `getCameraViewport()` (extent monde au bon zoom) ; (3) `camera.position = center - viewport/2`.

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `packages/gameplay/test/camera-sync-system.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { Bound, Transform2D, Vec2 } from "@atlasjs/math";
import { Camera2D, NebulaRenderer } from "@atlasjs/nebula";
import { Entity, NexusWorld } from "@atlasjs/nexus";

import { Camera, WorldTransform2D } from "../src/components";
import { CameraManager } from "../src/camera";
import { CameraSyncSystem } from "../src/systems";

const LOGICAL_W: number = 800;
const LOGICAL_H: number = 600;

function fakeNebula(camera: Camera2D): NebulaRenderer {
  return {
    camera,
    getCameraViewport(): Bound {
      return Bound.create(
        camera.position.x,
        camera.position.y,
        LOGICAL_W / camera.zoom,
        LOGICAL_H / camera.zoom,
      );
    },
  } as unknown as NebulaRenderer;
}

function setup(): {
  world: NexusWorld;
  camera2d: Camera2D;
  manager: CameraManager;
  system: CameraSyncSystem;
} {
  const world: NexusWorld = new NexusWorld();
  world.defineComponent(Camera).defineComponent(WorldTransform2D);

  const camera2d: Camera2D = new Camera2D();
  const nebula: NebulaRenderer = fakeNebula(camera2d);
  const manager: CameraManager = new CameraManager(nebula);
  const system: CameraSyncSystem = new CameraSyncSystem(manager, nebula);

  return { world, camera2d, manager, system };
}

function makeCamera(world: NexusWorld, cx: number, cy: number, zoom: number): Entity {
  const entity: Entity = world.createEntity();
  const cam: Camera = world.addComponent(entity, Camera);
  cam.zoom = zoom;
  const transform: Transform2D = new Transform2D().setPosition(cx, cy);
  world.addComponent(entity, WorldTransform2D).matrix.fromTransform2D(transform);
  return entity;
}

describe("CameraSyncSystem", () => {
  it("bakes the centered position and zoom into the render camera", () => {
    const { world, camera2d, manager, system } = setup();
    const entity: Entity = makeCamera(world, 500, 300, 2);
    manager.setActive(entity);

    system.update({ world, dt: 0 });

    expect(camera2d.zoom).toBe(2);
    expect(camera2d.position.x).toBeCloseTo(500 - LOGICAL_W / 2 / 2);
    expect(camera2d.position.y).toBeCloseTo(300 - LOGICAL_H / 2 / 2);
  });

  it("round-trips: screen center maps back to the camera world center", () => {
    const { world, camera2d, manager, system } = setup();
    const entity: Entity = makeCamera(world, 500, 300, 2);
    manager.setActive(entity);

    system.update({ world, dt: 0 });
    const center: Vec2 = camera2d.screenToWorld(new Vec2(LOGICAL_W / 2, LOGICAL_H / 2));

    expect(center.x).toBeCloseTo(500);
    expect(center.y).toBeCloseTo(300);
  });

  it("does nothing when there is no active camera", () => {
    const { world, camera2d, system } = setup();
    camera2d.setPosition(42, 42).setZoom(9);

    system.update({ world, dt: 0 });

    expect(camera2d.position.x).toBe(42);
    expect(camera2d.position.y).toBe(42);
    expect(camera2d.zoom).toBe(9);
  });

  it("does nothing when the active entity lacks Camera/WorldTransform2D", () => {
    const { world, camera2d, manager, system } = setup();
    const bare: Entity = world.createEntity();
    manager.setActive(bare);
    camera2d.setPosition(7, 7).setZoom(3);

    system.update({ world, dt: 0 });

    expect(camera2d.position.x).toBe(7);
    expect(camera2d.zoom).toBe(3);
  });
});
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run: `pnpm --filter @atlasjs/gameplay test -- camera-sync-system`
Expected: FAIL — `CameraSyncSystem` introuvable dans `../src/systems`.

- [ ] **Step 3 : Implémenter le système + l'export**

`packages/gameplay/src/systems/CameraSyncSystem.ts` :

```ts
import { Bound, Vec2 } from "@atlasjs/math";
import { Camera2D, NebulaRenderer } from "@atlasjs/nebula";
import { Entity, NexusSystem, NexusSystemContext } from "@atlasjs/nexus";

import { CameraManager } from "../camera";
import { Camera, WorldTransform2D } from "../components";

export class CameraSyncSystem implements NexusSystem {
  private readonly manager: CameraManager;
  private readonly renderer: NebulaRenderer;
  private readonly centerScratch: Vec2;

  public constructor(manager: CameraManager, renderer: NebulaRenderer) {
    this.manager = manager;
    this.renderer = renderer;
    this.centerScratch = new Vec2();
  }

  public update({ world }: NexusSystemContext): void {
    const active: Entity | undefined = this.manager.getActive();
    if (active === undefined) return;

    const wt: WorldTransform2D | undefined = world.getComponent(active, WorldTransform2D);
    const cam: Camera | undefined = world.getComponent(active, Camera);
    if (wt === undefined || cam === undefined) return;

    const center: Vec2 = wt.getPosition(this.centerScratch);
    const camera: Camera2D = this.renderer.camera;

    camera.zoom = cam.zoom;
    const viewport: Bound = this.renderer.getCameraViewport();
    camera.position.set(
      center.x - viewport.width / 2,
      center.y - viewport.height / 2,
    );
  }
}
```

Ajouter dans `packages/gameplay/src/systems/index.ts` (avant `AnimatorSystem` pour garder l'ordre alpha) :

```ts
export * from "./CameraSyncSystem";
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `pnpm --filter @atlasjs/gameplay test -- camera-sync-system`
Expected: PASS (les 4 cas).

- [ ] **Step 5 : Commit**

```bash
git add packages/gameplay/src/systems/CameraSyncSystem.ts packages/gameplay/src/systems/index.ts packages/gameplay/test/camera-sync-system.test.ts
git commit -m "feat(gameplay): CameraSyncSystem (centered, pushes active camera to nebula)"
```

---

### Task 6: Façade `CameraApi` (gameplay scripting) — ✅ DONE

**Files:**
- Create: `packages/gameplay/src/scripting/services/CameraApi.ts`
- Modify: `packages/gameplay/src/scripting/services/index.ts`
- Test: `packages/gameplay/test/camera-api.test.ts`

**Interfaces:**
- Consumes: `CameraManager` + `CAMERA_MANAGER` (Task 4), `ScriptService` (`scripting/core`).
- Produces: `class CameraApi extends ScriptService<CameraManager>` avec `static token = CAMERA_MANAGER`, `screenToWorld(screen, out?)`, `worldToScreen(world, out?)`, `setMain(entity)`.

> Miroir exact d'`InputApi`. `camera/` reste ignorant de `scripting/` (la dépendance va scripting → camera).

- [ ] **Step 1 : Écrire le test qui échoue**

S'inspirer de `packages/gameplay/test/input-api.test.ts`. Créer `packages/gameplay/test/camera-api.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { ServiceRegistry } from "@atlasjs/core";
import { Vec2 } from "@atlasjs/math";
import { Camera2D, NebulaRenderer } from "@atlasjs/nebula";
import { Entity } from "@atlasjs/nexus";

import { CameraManager, CAMERA_MANAGER } from "../src/camera";
import { CameraApi } from "../src/scripting/services";

function fakeNebula(camera: Camera2D): NebulaRenderer {
  return { camera } as unknown as NebulaRenderer;
}

function setup(): { manager: CameraManager; api: CameraApi } {
  const camera: Camera2D = new Camera2D();
  camera.setPosition(100, 50).setZoom(2);
  const manager: CameraManager = new CameraManager(fakeNebula(camera));

  const services: ServiceRegistry = new ServiceRegistry();
  services.provide(CAMERA_MANAGER, manager);

  return { manager, api: new CameraApi(services) };
}

describe("CameraApi", () => {
  it("exposes the CAMERA_MANAGER token", () => {
    expect(CameraApi.token).toBe(CAMERA_MANAGER);
  });

  it("delegates screenToWorld to the manager", () => {
    const { api } = setup();
    const world: Vec2 = api.screenToWorld(new Vec2(800, 600));
    expect(world.x).toBeCloseTo(100 + 400);
    expect(world.y).toBeCloseTo(50 + 300);
  });

  it("setMain forwards to the manager", () => {
    const { manager, api } = setup();
    const entity: Entity = 5 as unknown as Entity;
    api.setMain(entity);
    expect(manager.getActive()).toBe(entity);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `pnpm --filter @atlasjs/gameplay test -- camera-api`
Expected: FAIL — `CameraApi` introuvable dans `../src/scripting/services`.

- [ ] **Step 3 : Créer la façade + l'export**

`packages/gameplay/src/scripting/services/CameraApi.ts` :

```ts
import { Vec2 } from "@atlasjs/math";
import { Entity } from "@atlasjs/nexus";

import { CameraManager, CAMERA_MANAGER } from "../../camera";

import { ScriptService } from "../core";

export class CameraApi extends ScriptService<CameraManager> {
  public static readonly token = CAMERA_MANAGER;

  public screenToWorld(screen: Vec2, out?: Vec2): Vec2 {
    return this.provided.screenToWorld(screen, out);
  }

  public worldToScreen(world: Vec2, out?: Vec2): Vec2 {
    return this.provided.worldToScreen(world, out);
  }

  public setMain(entity: Entity): void {
    this.provided.setActive(entity);
  }
}
```

Ajouter dans `packages/gameplay/src/scripting/services/index.ts` :

```ts
export * from "./CameraApi";
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `pnpm --filter @atlasjs/gameplay test -- camera-api`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add packages/gameplay/src/scripting/services/CameraApi.ts packages/gameplay/src/scripting/services/index.ts packages/gameplay/test/camera-api.test.ts
git commit -m "feat(gameplay): CameraApi script service facade"
```

---

### Task 7: Câblage `GameplayPlugin` — ✅ DONE

**Files:**
- Modify: `packages/gameplay/src/GameplayPlugin.ts`
- Test: `packages/gameplay/test/camera-plugin.test.ts`

**Interfaces:**
- Consumes: `Camera` (Task 3), `CameraManager` + `CAMERA_MANAGER` (Task 4), `CameraSyncSystem` (Task 5).
- Produces: le service `CAMERA_MANAGER` est `provide`é ; `CameraSyncSystem` tourne en `render/PreRender` avant `gameplay:sprite-render` ; `onRemove(Camera)` vide la caméra active si c'est elle.

- [ ] **Step 1 : Écrire le test qui échoue (via le harness)**

Créer `packages/gameplay/test/camera-plugin.test.ts` (le harness fournit un stub nebula ; on ne teste ici que le câblage : provide + auto-clear on remove, sans math caméra) :

```ts
import { describe, expect, it } from "vitest";
import { Entity } from "@atlasjs/nexus";

import { Camera, CameraManager, CAMERA_MANAGER } from "../src";
import { createHarness, Harness } from "./helpers/harness";

describe("GameplayPlugin — camera wiring", () => {
  it("provides the CameraManager service", async () => {
    const h: Harness = await createHarness();
    const manager: CameraManager = h.services.get(CAMERA_MANAGER);
    expect(manager).toBeInstanceOf(CameraManager);
  });

  it("clears the active camera when its Camera component is removed", async () => {
    const h: Harness = await createHarness();
    const manager: CameraManager = h.services.get(CAMERA_MANAGER);

    const entity: Entity = h.world.createEntity();
    h.world.addComponent(entity, Camera);
    manager.setActive(entity);
    expect(manager.getActive()).toBe(entity);

    h.world.removeComponent(entity, Camera);
    expect(manager.getActive()).toBeUndefined();
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `pnpm --filter @atlasjs/gameplay test -- camera-plugin`
Expected: FAIL — `CAMERA_MANAGER` non fourni / import `Camera`/`CameraManager` absent du service (selon l'état), le `get(CAMERA_MANAGER)` throw « service absent ».

- [ ] **Step 3 : Câbler le plugin**

Dans `packages/gameplay/src/GameplayPlugin.ts` :

1. Ajouter aux imports de composants (`from "./components"`) : `Camera`.
2. Ajouter aux imports de systèmes (`from "./systems"`) : `CameraSyncSystem`.
3. Ajouter un import : `import { CameraManager, CAMERA_MANAGER } from "./camera";`.
4. Déclarer le provide dans le `super(...)` — passer `provides: [SCRIPT_MANAGER, CAMERA_MANAGER]`.
5. Dans `install`, après la construction des autres systèmes, construire :

```ts
    const cameraManager: CameraManager = new CameraManager(nebula);
    const cameraSyncSystem: CameraSyncSystem = new CameraSyncSystem(cameraManager, nebula);
```

6. Ajouter `.defineComponent(Camera)` à la chaîne `world.defineComponent(...)`.
7. Ajouter l'auto-clear dans le `this.unsubscribers.push(...)` :

```ts
      world.onRemove(Camera, (entity: Entity) => {
        if (cameraManager.getActive() === entity) {
          cameraManager.setActive(undefined);
        }
      }),
```

8. Enregistrer le système (dans un `this.handles.push(...)`), en `render/PreRender` avant sprite-render :

```ts
    this.handles.push(
      registerSystem(render, world, cameraSyncSystem, {
        name: "gameplay:camera-sync",
        stage: "PreRender",
        before: "gameplay:sprite-render",
      }),
    );
```

9. Fournir le service avant `this.deferred.resolve()` :

```ts
    engine.services.provide(CAMERA_MANAGER, cameraManager);
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `pnpm --filter @atlasjs/gameplay test -- camera-plugin`
Expected: PASS.

- [ ] **Step 5 : Suite complète + typecheck**

Run: `pnpm --filter @atlasjs/gameplay test`
Expected: PASS (toute la suite gameplay, aucun régression).

Run: `pnpm --filter @atlasjs/gameplay exec tsc --noEmit`
Expected: aucune erreur (⚠️ `--noEmit`, jamais `tsc -b`).

- [ ] **Step 6 : Rebuild le dist de gameplay (consommé par le sandbox)**

Run: `pnpm --filter @atlasjs/gameplay build`
Expected: build OK.

- [ ] **Step 7 : Commit**

```bash
git add packages/gameplay/src/GameplayPlugin.ts packages/gameplay/test/camera-plugin.test.ts
git commit -m "feat(gameplay): wire Camera component, CameraManager, CameraSyncSystem in GameplayPlugin"
```

---

### Task 8 (optionnel) : Démo sandbox + vérification navigateur

**Files:**
- Modify: `apps/sandbox/src/game/EcsScene.ts`

**But :** valider visuellement le follow-camera + le screen↔world dans l'app réelle.

- [ ] **Step 1 : Créer une main camera enfant du joueur dans `EcsScene.onCreate`**

Dans `apps/sandbox/src/game/EcsScene.ts`, importer le nécessaire depuis `@atlasjs/gameplay` : `type CameraManager`, `CAMERA_MANAGER`, `Camera`, et `Transform2D` (composant LEVEL 1). Après la création de `player` et l'attache des scripts, ajouter :

```ts
    const cameraManager: CameraManager = ctx.services.get(CAMERA_MANAGER);

    const cameraEntity: Entity = nexus.createEntity();
    nexus.addComponent(cameraEntity, Transform2D);
    const cameraComp: Camera = nexus.addComponent(cameraEntity, Camera);
    cameraComp.zoom = 1;
    nexus.setParent(cameraEntity, player);
    cameraManager.setActive(cameraEntity);
```

(`Entity` est déjà importé depuis `@atlasjs/nexus` dans ce fichier.)

- [ ] **Step 2 : Lancer le dev server du sandbox**

Utiliser l'outil de preview (config `sandbox`, port 5174) — ne pas lancer un serveur via Bash.

- [ ] **Step 3 : Vérifier le rendu**

- Console navigateur : aucune erreur (`read_console_messages`).
- Bouger le joueur (WASD) → la vue **suit** le joueur qui reste au **centre** de l'écran (preuve du centrage + du parenting).
- Screenshot de preuve.

- [ ] **Step 4 : (Optionnel) sanity screenToWorld**

Dans un script existant (`onUpdate`), sur clic souris, log `this.getService(CameraApi).screenToWorld(this.getService(InputApi).mousePosition)` et vérifier en console que la coordonnée monde correspond à la position cliquée dans la scène. Retirer le log après validation.

- [ ] **Step 5 : Commit**

```bash
git add apps/sandbox/src/game/EcsScene.ts
git commit -m "feat(sandbox): main camera follows the player (camera demo)"
```

---

## Self-Review (fait à la rédaction)

- **Couverture spec** : §4 `Camera2D` screen↔world → Task 1 ; §4bis passthrough → Task 2 ; §5 composant `Camera` → Task 3 ; §6 `CameraManager` + token → Task 4 ; §7 `CameraSyncSystem` (centrage) → Task 5 ; §8 `CameraApi` → Task 6 ; §10 câblage plugin (define/provide/register/onRemove) → Task 7 ; §11 exports → Tasks 3/4/6 ; §12 création main camera → Task 8 ; §13 tests → cas dans chaque task ; §14 non-objectifs → hors périmètre (backlog). ✅
- **Placeholders** : aucun (chaque step porte le code/commande réels). ✅
- **Cohérence des types** : `Camera.zoom`, `CameraManager.{setActive,getActive,screenToWorld,worldToScreen}`, `CAMERA_MANAGER: ServiceToken<CameraManager>`, `CameraSyncSystem.update({world})`, `CameraApi.{token,screenToWorld,worldToScreen,setMain}`, `NebulaRenderer.getCameraViewport(): Bound`, `Camera2D.{screenToWorld,worldToScreen}(Vec2, out?)` — noms/signatures identiques entre tasks productrices et consommatrices. ✅
- **Anti-cycle** : `camera/` ne dépend que de packages externes ; `scripting/services/CameraApi` → `camera` (sens unique) ; token co-localisé dans `camera/tokens.ts` (pas dans le `tokens.ts` racine qui, lui, importe `scripting`). ✅

## Backlog à mettre à jour (après implémentation, hors code)

Ajouter à `docs/backlog.md` une entrée « Gameplay — Caméra » (source `docs/gameplay/camera.md`, §14) : rendu simultané multi-caméras (RenderPass par caméra + viewport rects), rotation de caméra (exige `Mat4.invert`), `clearColor`/`viewport rect`/`renderTarget` par caméra, couches/culling mask, mode edit↔play formel, projection non-ortho. Noter aussi que Task 1 débloque partiellement **B2** (méthodes `Camera2D` pour l'éditeur).
