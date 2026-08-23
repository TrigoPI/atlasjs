# TrailRenderer — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer un `TrailRenderer` utilisable comme celui d'Unity — on pose le composant sur une entité, elle laisse une traînée derrière elle.

**Architecture:** Un ruban dont les joints sont étanches, obtenu **sur le chemin instancié existant** : une instance = un segment, portant les offsets miter de ses deux extrémités, calculés une fois par point côté CPU et partagés à l'identique entre segments voisins. Aucun vertex buffer dynamique, aucun buffer GPU par trail, aucun code de pipeline. Le nœud `TrailNode` porte la simulation (ring buffer, vieillissement, éviction) ; le système ECS ne fait que le nourrir.

**Tech Stack:** TypeScript, Turborepo + pnpm, vitest, WebGPU + WGSL, packages `@atlasjs/nebula`, `@atlasjs/nebula-webgpu`, `@atlasjs/gameplay`.

**Design de référence :** [`docs/rendering/trails.md`](../rendering/trails.md) — à lire avant de commencer.

## Global Constraints

- Core **backend-agnostic** : aucun WGSL, aucun `@webgpu/types`, aucun import backend dans `@atlasjs/nebula`.
- WGSL = source de vérité côté backend ; la **réflexion est l'autorité de layout** (jamais d'offsets codés en dur).
- **Tout est typé**, y compris quand le type est trivial : paramètres de fonction, variables locales, champs de classe.
- **Aucun commentaire ajouté** dans le code.
- **Zéro allocation par frame** dans le chemin de rendu.
- **`import type`** obligatoire pour les symboles type-only dans les fichiers d'app (`verbatimModuleSyntax`) — un import de valeur pour un type passe `tsc` mais casse au runtime sous Vite (écran noir).
- **Rebuild du `dist`** après tout changement d'API publique d'un package : `pnpm --filter <pkg> build`, sinon le consommateur suivant type-check contre l'ancienne API.
- **Pas de commit automatique** : chaque tâche se termine par un `git add` des fichiers touchés, formatés, et le message de commit proposé. C'est l'opérateur qui commite.
- Prettier **scopé aux fichiers touchés**, jamais `pnpm format` (repo-wide, qui reformaterait les `.md`).

## Fichiers

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `packages/nebula/src/graphics/TrailNode.ts` | Ring buffer de points monde + simulation (émission, vieillissement, éviction, capacité) | 1 |
| `packages/nebula/src/core/renderer/SpriteBatch.ts` | + interface `TrailBatch` | 2 |
| `packages/nebula/src/core/renderer/ResourceFactory.ts` | + `createTrailBatch()` | 2 |
| `packages/nebula-webgpu/src/shaders/trail.wgsl` | Le seul WGSL neuf : quad par segment, bords miter, feather | 2 |
| `packages/nebula-webgpu/src/batch/WebGPUTrailBatch.ts` | Empaquetage du storage buffer de segments | 2 |
| `packages/nebula/src/renderers/DrawCommand.ts` | + `TrailDrawCommand` (données **par point**) | 3 |
| `packages/nebula/src/renderers/TrailNodeRenderer.ts` | Normales, miters, largeurs, couleurs, cull | 3 |
| `packages/nebula/src/renderers/Batchers.ts` | + `TrailBatcher` : appariement point → segment | 3 |
| `packages/gameplay/src/components/TrailRenderer.ts` | Les molettes côté ECS | 4 |
| `packages/gameplay/src/systems/TrailRenderSystem.ts` | Montage, échantillonnage, tri, trails détachés | 4 |

---

### Task 1: `TrailNode` — le nœud et sa simulation

**Files:**
- Create: `packages/nebula/src/graphics/TrailNode.ts`
- Modify: `packages/nebula/src/graphics/index.ts`
- Test: `packages/nebula/test/TrailNode.test.ts`

**Interfaces:**
- Consumes: `Node` (`packages/nebula/src/graphics/Node.ts`), `Color` (`packages/nebula/src/utils/Color.ts`), `BlendMode` (`packages/nebula/src/core/core-types.ts`).
- Produces:
  ```ts
  class TrailNode extends Node {
    time: number;               // 0.2
    minVertexDistance: number;  // 2
    startWidth: number;         // 8
    endWidth: number;           // 0
    startColor: Color;          // (1,1,1,1)
    endColor: Color;            // (1,1,1,0)
    blend: BlendMode;           // "alpha"
    get pointCount(): number;
    get capacity(): number;
    setCapacity(capacity: number): this;   // clampé à >= 2, tronque depuis la queue
    emit(x: number, y: number): void;
    advance(dt: number): void;
    clear(): this;
    getPointX(index: number): number;      // index 0 = tête (le plus récent)
    getPointY(index: number): number;
    getPointAge(index: number): number;
  }
  ```

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `packages/nebula/test/TrailNode.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { TrailNode } from "../src/graphics/TrailNode";

describe("TrailNode.emit", () => {
  it("crée le premier point à la position émise", () => {
    const node: TrailNode = new TrailNode();
    node.emit(10, 20);

    expect(node.pointCount).toBe(1);
    expect(node.getPointX(0)).toBe(10);
    expect(node.getPointY(0)).toBe(20);
  });

  it("déplace la tête sans committer sous minVertexDistance", () => {
    const node: TrailNode = new TrailNode();
    node.minVertexDistance = 5;
    node.emit(0, 0);
    node.emit(1, 0);
    node.emit(2, 0);

    expect(node.pointCount).toBe(1);
    expect(node.getPointX(0)).toBe(2);
  });

  it("committe un nouveau point au-delà de minVertexDistance, tête en index 0", () => {
    const node: TrailNode = new TrailNode();
    node.minVertexDistance = 5;
    node.emit(0, 0);
    node.emit(10, 0);

    expect(node.pointCount).toBe(2);
    expect(node.getPointX(0)).toBe(10);
    expect(node.getPointX(1)).toBe(0);
  });

  it("remet l'âge de la tête à zéro quand elle se déplace", () => {
    const node: TrailNode = new TrailNode();
    node.minVertexDistance = 5;
    node.time = 0.2;

    node.emit(0, 0);
    node.advance(0.15);
    node.emit(1, 0);

    expect(node.getPointAge(0)).toBe(0);

    node.advance(0.15);

    expect(node.pointCount).toBe(1);
    expect(node.getPointAge(0)).toBeCloseTo(0.15);
  });
});

describe("TrailNode.advance", () => {
  it("évince depuis la queue les points plus vieux que time", () => {
    const node: TrailNode = new TrailNode();
    node.minVertexDistance = 5;
    node.time = 0.2;

    node.emit(0, 0);
    node.advance(0.15);
    node.emit(10, 0);
    node.advance(0.1);

    expect(node.pointCount).toBe(1);
    expect(node.getPointX(0)).toBe(10);
  });

  it("vide entièrement le trail quand tout a expiré", () => {
    const node: TrailNode = new TrailNode();
    node.minVertexDistance = 5;
    node.time = 0.2;

    node.emit(0, 0);
    node.emit(10, 0);
    node.advance(0.5);

    expect(node.pointCount).toBe(0);
  });
});

describe("TrailNode capacity", () => {
  it("retire le plus vieux point quand le buffer est plein", () => {
    const node: TrailNode = new TrailNode(3);
    node.minVertexDistance = 1;
    node.time = 10;

    node.emit(0, 0);
    node.emit(10, 0);
    node.emit(20, 0);
    node.emit(30, 0);

    expect(node.pointCount).toBe(3);
    expect(node.getPointX(0)).toBe(30);
    expect(node.getPointX(2)).toBe(10);
  });

  it("setCapacity conserve les points les plus récents et clampe à 2", () => {
    const node: TrailNode = new TrailNode(8);
    node.minVertexDistance = 1;
    node.time = 10;

    node.emit(0, 0);
    node.emit(10, 0);
    node.emit(20, 0);
    node.setCapacity(2);

    expect(node.capacity).toBe(2);
    expect(node.pointCount).toBe(2);
    expect(node.getPointX(0)).toBe(20);
    expect(node.getPointX(1)).toBe(10);

    node.setCapacity(1);
    expect(node.capacity).toBe(2);
  });

  it("clear remet le trail à zéro", () => {
    const node: TrailNode = new TrailNode();
    node.emit(0, 0);
    node.clear();

    expect(node.pointCount).toBe(0);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

```bash
pnpm --filter @atlasjs/nebula test TrailNode.test
```

Attendu : ÉCHEC — `Failed to resolve import "../src/graphics/TrailNode"`.

- [ ] **Step 3: Écrire `TrailNode`**

Créer `packages/nebula/src/graphics/TrailNode.ts` :

```ts
import { BlendMode } from "../core";
import { Color } from "../utils";
import { Node } from "./Node";

const DEFAULT_CAPACITY: number = 64;
const MIN_CAPACITY: number = 2;

export class TrailNode extends Node {
  public time: number;
  public minVertexDistance: number;
  public startWidth: number;
  public endWidth: number;
  public startColor: Color;
  public endColor: Color;
  public blend: BlendMode;

  private xs: Float32Array;
  private ys: Float32Array;
  private ages: Float32Array;
  private head: number;
  private count: number;

  public constructor(capacity: number = DEFAULT_CAPACITY) {
    super();

    const size: number = Math.max(MIN_CAPACITY, capacity);

    this.time = 0.2;
    this.minVertexDistance = 2;
    this.startWidth = 8;
    this.endWidth = 0;
    this.startColor = new Color(1, 1, 1, 1);
    this.endColor = new Color(1, 1, 1, 0);
    this.blend = "alpha";

    this.xs = new Float32Array(size);
    this.ys = new Float32Array(size);
    this.ages = new Float32Array(size);
    this.head = 0;
    this.count = 0;
  }

  public get pointCount(): number {
    return this.count;
  }

  public get capacity(): number {
    return this.xs.length;
  }

  public setCapacity(capacity: number): this {
    const size: number = Math.max(MIN_CAPACITY, capacity);

    if (size === this.xs.length) {
      return this;
    }

    const kept: number = Math.min(this.count, size);
    const xs: Float32Array = new Float32Array(size);
    const ys: Float32Array = new Float32Array(size);
    const ages: Float32Array = new Float32Array(size);

    for (let i: number = 0; i < kept; i++) {
      const slot: number = this.slotOf(i);
      xs[i] = this.xs[slot];
      ys[i] = this.ys[slot];
      ages[i] = this.ages[slot];
    }

    this.xs = xs;
    this.ys = ys;
    this.ages = ages;
    this.head = 0;
    this.count = kept;

    return this;
  }

  public emit(x: number, y: number): void {
    if (this.count === 0) {
      this.push(x, y);
      return;
    }

    const dx: number = x - this.xs[this.head];
    const dy: number = y - this.ys[this.head];
    const threshold: number = this.minVertexDistance * this.minVertexDistance;

    if (dx * dx + dy * dy >= threshold) {
      this.push(x, y);
      return;
    }

    this.xs[this.head] = x;
    this.ys[this.head] = y;
    this.ages[this.head] = 0;
  }

  public advance(dt: number): void {
    for (let i: number = 0; i < this.count; i++) {
      this.ages[this.slotOf(i)] += dt;
    }

    while (this.count > 0 && this.ages[this.slotOf(this.count - 1)] > this.time) {
      this.count--;
    }
  }

  public clear(): this {
    this.head = 0;
    this.count = 0;
    return this;
  }

  public getPointX(index: number): number {
    return this.xs[this.slotOf(index)];
  }

  public getPointY(index: number): number {
    return this.ys[this.slotOf(index)];
  }

  public getPointAge(index: number): number {
    return this.ages[this.slotOf(index)];
  }

  private push(x: number, y: number): void {
    const size: number = this.xs.length;

    this.head = (this.head - 1 + size) % size;
    this.xs[this.head] = x;
    this.ys[this.head] = y;
    this.ages[this.head] = 0;

    if (this.count < size) {
      this.count++;
    }
  }

  private slotOf(index: number): number {
    return (this.head + index) % this.xs.length;
  }
}
```

La tête reculant d'un cran à chaque `push`, un buffer plein écrase exactement le slot du point le plus vieux — l'éviction par capacité est gratuite.

- [ ] **Step 4: Exporter le nœud**

Dans `packages/nebula/src/graphics/index.ts`, ajouter la ligne dans l'ordre alphabétique — entre `./TileMapNode` et `./Transformable` :

```ts
export * from "./TrailNode";
```

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils passent**

```bash
pnpm --filter @atlasjs/nebula test TrailNode.test
```

Attendu : 9 tests passés.

- [ ] **Step 6: Rebuild du dist (API publique changée)**

```bash
pnpm --filter @atlasjs/nebula build
```

- [ ] **Step 7: Formater et stager**

```bash
pnpm exec prettier --write packages/nebula/src/graphics/TrailNode.ts packages/nebula/src/graphics/index.ts packages/nebula/test/TrailNode.test.ts
git add packages/nebula/src/graphics/TrailNode.ts packages/nebula/src/graphics/index.ts packages/nebula/test/TrailNode.test.ts
```

Message de commit proposé à l'opérateur (c'est lui qui commite) :

```
feat(nebula): add TrailNode
```

---

### Task 2: `TrailBatch`, le shader et le batch WebGPU

Rien ne dessine encore à la fin de cette tâche : c'est la plomberie, et elle compile seule.

**Files:**
- Modify: `packages/nebula/src/core/renderer/SpriteBatch.ts`
- Modify: `packages/nebula/src/core/renderer/ResourceFactory.ts`
- Create: `packages/nebula-webgpu/src/shaders/trail.wgsl`
- Create: `packages/nebula-webgpu/src/batch/WebGPUTrailBatch.ts`
- Modify: `packages/nebula-webgpu/src/batch/index.ts`
- Modify: `packages/nebula-webgpu/src/resources/WebGPUShaderList.ts`
- Modify: `packages/nebula-webgpu/src/WebGPURenderer.ts:194-197` (juste après `createShapeBatch`)
- Test: `packages/nebula-webgpu/test/WebGPUTrailBatch.test.ts`

**Interfaces:**
- Consumes: `InstancedBatch`, `RenderState` (`packages/nebula/src/core/renderer/SpriteBatch.ts`, `core-types.ts`), `WebGPUInstancedBatch` (`packages/nebula-webgpu/src/batch/WebGPUInstancedBatch.ts`).
- Produces:
  ```ts
  interface TrailBatch extends InstancedBatch {
    begin(renderState: RenderState): void;
    add(posA: Vec2, posB: Vec2, edgeA: Vec2, edgeB: Vec2, colorA: Vec4, colorB: Vec4): void;
  }
  interface ResourceFactory { createTrailBatch(): TrailBatch; }
  class WebGPUTrailBatch extends WebGPUInstancedBatch implements TrailBatch {}
  ```
  Shader built-in : nom `"trail"`, id `atlas.webgpu.trail`, entry points `vs_main` / `fs_main`.

- [ ] **Step 1: Écrire le test de layout qui échoue**

Ce test est le garde-fou du design : il vérifie que la réflexion WGSL produit bien un stride de 64 octets sans padding, et que chaque membre atterrit là où le vertex shader le lira.

Créer `packages/nebula-webgpu/test/WebGPUTrailBatch.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Vec2, Vec4 } from "@atlasjs/math";
import type { RenderState } from "@atlasjs/nebula";
import { WebGPUShader } from "../src/material";
import { WebGPUReflection } from "../src/reflect";
import { WebGPUTrailBatch } from "../src/batch/WebGPUTrailBatch";

const STATE: RenderState = { blend: "alpha", depthTest: false, cull: "none" };

function readShader(name: string): string {
  return readFileSync(new URL(`../src/shaders/${name}`, import.meta.url), "utf8");
}

function trailShader(): WebGPUShader {
  const source: string = readShader("trail.wgsl");
  const code: string = `${readShader("global.wgsl")}\n\n${source}`;

  return new WebGPUShader(
    {} as GPUShaderModule,
    {
      id: "atlas.webgpu.trail",
      source,
      vertexEntryPoint: "vs_main",
      fragmentEntryPoint: "fs_main",
    },
    WebGPUReflection.reflect(code),
  );
}

describe("WebGPUTrailBatch", () => {
  it("empaquette un segment en 64 octets, membres dans l'ordre du shader", () => {
    const batch: WebGPUTrailBatch = new WebGPUTrailBatch(trailShader());

    batch.begin(STATE);
    batch.add(
      new Vec2(1, 2),
      new Vec2(3, 4),
      new Vec2(5, 6),
      new Vec2(7, 8),
      new Vec4(0.1, 0.2, 0.3, 0.4),
      new Vec4(0.5, 0.6, 0.7, 0.8),
    );

    expect(batch.count).toBe(1);
    expect(batch.byteSize).toBe(64);

    const packed: Float32Array = new Float32Array(batch.pack());

    expect([...packed.slice(0, 8)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...packed.slice(8, 12)].map((v: number) => Math.round(v * 10))).toEqual([1, 2, 3, 4]);
    expect([...packed.slice(12, 16)].map((v: number) => Math.round(v * 10))).toEqual([5, 6, 7, 8]);
  });

  it("remet le compteur à zéro à chaque begin", () => {
    const batch: WebGPUTrailBatch = new WebGPUTrailBatch(trailShader());
    const zero: Vec2 = new Vec2(0, 0);
    const white: Vec4 = new Vec4(1, 1, 1, 1);

    batch.begin(STATE);
    batch.add(zero, zero, zero, zero, white, white);
    batch.begin(STATE);

    expect(batch.count).toBe(0);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
pnpm --filter @atlasjs/nebula-webgpu test WebGPUTrailBatch
```

Attendu : ÉCHEC — imports `trail.wgsl` et `WebGPUTrailBatch` introuvables.

- [ ] **Step 3: Écrire le shader**

Créer `packages/nebula-webgpu/src/shaders/trail.wgsl`. `uGlobal` n'est **pas** déclaré ici : le prélude `global.wgsl` est préfixé par `WebGPUShaderCache`, exactement comme dans `shape_instanced.wgsl`.

```wgsl
struct Segment {
  posA: vec2<f32>,
  posB: vec2<f32>,
  edgeA: vec2<f32>,
  edgeB: vec2<f32>,
  colorA: vec4<f32>,
  colorB: vec4<f32>,
};

@group(1) @binding(0)
var<storage, read> segments: array<Segment>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) side: f32,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(0.0, -1.0),
    vec2<f32>(0.0,  1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(0.0,  1.0),
    vec2<f32>(1.0,  1.0),
  );

  let segment = segments[instanceIndex];
  let corner = corners[vertexIndex];
  let far: bool = corner.x > 0.5;

  let base: vec2<f32> = select(segment.posA, segment.posB, far);
  let edge: vec2<f32> = select(segment.edgeA, segment.edgeB, far);
  let color: vec4<f32> = select(segment.colorA, segment.colorB, far);

  var out: VertexOutput;
  out.position = uGlobal.viewProjection * vec4<f32>(base + edge * corner.y, 0.0, 1.0);
  out.color = color;
  out.side = corner.y;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let aa: f32 = max(fwidth(in.side), 1e-5);
  let coverage: f32 = clamp((1.0 - abs(in.side)) / aa, 0.0, 1.0);
  return vec4<f32>(in.color.rgb, in.color.a * coverage);
}
```

`select` et non `mix` : la sélection ne fait aucune arithmétique, donc les deux segments d'un joint produisent des positions bit-à-bit identiques. C'est ce qui rend le ruban étanche jusqu'au rasterizer.

- [ ] **Step 4: Ajouter l'interface `TrailBatch` au core**

Dans `packages/nebula/src/core/renderer/SpriteBatch.ts`, après l'interface `ShapeBatch`, et en complétant l'import de `@atlasjs/math` avec `Vec2` :

```ts
export interface TrailBatch extends InstancedBatch {
  begin(renderState: RenderState): void;
  add(
    posA: Vec2,
    posB: Vec2,
    edgeA: Vec2,
    edgeB: Vec2,
    colorA: Vec4,
    colorB: Vec4,
  ): void;
}
```

Dans `packages/nebula/src/core/renderer/ResourceFactory.ts`, ajouter `TrailBatch` à l'import depuis `./SpriteBatch`, puis la méthode après `createShapeBatch()` :

```ts
  createTrailBatch(): TrailBatch;
```

- [ ] **Step 5: Écrire `WebGPUTrailBatch`**

Créer `packages/nebula-webgpu/src/batch/WebGPUTrailBatch.ts` :

```ts
import { Vec2, Vec4 } from "@atlasjs/math";

import { WebGPUInstancedBatch } from "./WebGPUInstancedBatch";

import { TrailBatch, RenderState, BindingValue } from "@atlasjs/nebula";

export class WebGPUTrailBatch
  extends WebGPUInstancedBatch
  implements TrailBatch
{
  private readonly posA: Vec2[] = [];
  private readonly posB: Vec2[] = [];
  private readonly edgeA: Vec2[] = [];
  private readonly edgeB: Vec2[] = [];
  private readonly colorA: Vec4[] = [];
  private readonly colorB: Vec4[] = [];

  public begin(renderState: RenderState): void {
    this.instanceCount = 0;
    this.state = renderState;
  }

  public add(
    posA: Vec2,
    posB: Vec2,
    edgeA: Vec2,
    edgeB: Vec2,
    colorA: Vec4,
    colorB: Vec4,
  ): void {
    this.posA[this.instanceCount] = posA;
    this.posB[this.instanceCount] = posB;
    this.edgeA[this.instanceCount] = edgeA;
    this.edgeB[this.instanceCount] = edgeB;
    this.colorA[this.instanceCount] = colorA;
    this.colorB[this.instanceCount] = colorB;
    this.instanceCount++;
  }

  public override destroy(): void {
    this.posA.length = 0;
    this.posB.length = 0;
    this.edgeA.length = 0;
    this.edgeB.length = 0;
    this.colorA.length = 0;
    this.colorB.length = 0;
    super.destroy();
  }

  protected valueOf(index: number, name: string): BindingValue {
    if (name === "posA") return this.posA[index];
    if (name === "posB") return this.posB[index];
    if (name === "edgeA") return this.edgeA[index];
    if (name === "edgeB") return this.edgeB[index];
    if (name === "colorA") return this.colorA[index];
    return this.colorB[index];
  }
}
```

- [ ] **Step 6: Enregistrer le batch et le shader built-in**

Dans `packages/nebula-webgpu/src/batch/index.ts`, après `WebGPUShapeBatch` :

```ts
export * from "./WebGPUTrailBatch";
```

Dans `packages/nebula-webgpu/src/resources/WebGPUShaderList.ts` : ajouter l'import, l'entrée du dictionnaire et le built-in.

```ts
import TrailShader from "../shaders/trail.wgsl";
```

Dans l'objet passé à `WebGPUShaders`, après `ShapeInstanced` :

```ts
  Trail: {
    id: "atlas.webgpu.trail",
    vertexEntryPoint: "vs_main",
    fragmentEntryPoint: "fs_main",
    source: TrailShader,
  },
```

Dans `WebGPUBuiltinShaders`, après `shape` :

```ts
  trail: WebGPUShaders.Trail,
```

Dans `packages/nebula-webgpu/src/WebGPURenderer.ts`, juste après `createShapeBatch()` (ligne 197) :

```ts
  public createTrailBatch(): WebGPUTrailBatch {
    const shader: WebGPUShader = this.getBuiltinShader("trail");
    return new WebGPUTrailBatch(shader);
  }
```

Compléter l'import des batches en tête de `WebGPURenderer.ts` avec `WebGPUTrailBatch`.

- [ ] **Step 7: Lancer le test pour vérifier qu'il passe**

```bash
pnpm --filter @atlasjs/nebula build && pnpm --filter @atlasjs/nebula-webgpu test WebGPUTrailBatch
```

Attendu : 2 tests passés.

**Si `byteSize` n'est pas 64** : la réflexion a padé les `vec2`. Ne pas coder d'offsets en dur — remplacer les quatre `vec2` du struct WGSL par deux `vec4` (`endpoints: vec4<f32>` = `posA.xy, posB.xy` et `edges: vec4<f32>` = `edgeA.xy, edgeB.xy`), adapter `valueOf` pour retourner des `Vec4` construits dans le batch, et mettre à jour le vertex shader (`base = select(endpoints.xy, endpoints.zw, far)`). Le reste du plan est inchangé — seuls les noms des membres bougent.

- [ ] **Step 8: Vérifier que les deux packages compilent**

```bash
pnpm --filter @atlasjs/nebula-webgpu build
```

Attendu : build OK. C'est ce qui prouve que `WebGPURenderer` satisfait toujours `ResourceFactory` après l'ajout de `createTrailBatch`.

- [ ] **Step 9: Formater et stager**

```bash
pnpm exec prettier --write packages/nebula/src/core/renderer/SpriteBatch.ts packages/nebula/src/core/renderer/ResourceFactory.ts packages/nebula-webgpu/src/batch/WebGPUTrailBatch.ts packages/nebula-webgpu/src/batch/index.ts packages/nebula-webgpu/src/resources/WebGPUShaderList.ts packages/nebula-webgpu/src/WebGPURenderer.ts packages/nebula-webgpu/test/WebGPUTrailBatch.test.ts
git add packages/nebula/src/core/renderer/SpriteBatch.ts packages/nebula/src/core/renderer/ResourceFactory.ts packages/nebula-webgpu/src/shaders/trail.wgsl packages/nebula-webgpu/src/batch/WebGPUTrailBatch.ts packages/nebula-webgpu/src/batch/index.ts packages/nebula-webgpu/src/resources/WebGPUShaderList.ts packages/nebula-webgpu/src/WebGPURenderer.ts packages/nebula-webgpu/test/WebGPUTrailBatch.test.ts
```

Prettier ne traite pas le `.wgsl` — il est stagé tel quel.

Message de commit proposé :

```
feat(nebula-webgpu): add the trail batch and shader
```

---

### Task 3: `TrailNodeRenderer` — le ruban miter

**Files:**
- Modify: `packages/nebula/src/renderers/DrawCommand.ts`
- Modify: `packages/nebula/src/renderers/NodeRenderer.ts` (`KIND_ORDER`)
- Create: `packages/nebula/src/renderers/TrailNodeRenderer.ts`
- Modify: `packages/nebula/src/renderers/Batchers.ts`
- Modify: `packages/nebula/src/renderers/SceneRenderer.ts`
- Modify: `packages/nebula/src/renderers/index.ts`
- Modify: `apps/webgpu/src/index.ts`
- Test: `packages/nebula/test/TrailNodeRenderer.test.ts`

**Interfaces:**
- Consumes: `TrailNode` (Task 1), `TrailBatch` + `createTrailBatch()` (Task 2), `NodeRendererBase`, `NodeRenderer`, `Batcher`, `KIND_ORDER`, `Bound.overlaps`.
- Produces:
  ```ts
  type TrailDrawCommand = {
    readonly kind: "trail";
    readonly sortingLayer: number;
    readonly sortPrimary: number;
    readonly sortSecondary: number;
    readonly kindOrder: number;
    readonly batchKey: number;
    readonly renderState: RenderState;
    readonly positions: ReadonlyArray<Vec2>;  // par point, tête → queue
    readonly edges: ReadonlyArray<Vec2>;      // par point
    readonly colors: ReadonlyArray<Vec4>;     // par point
    readonly pointCount: number;
  };
  class TrailNodeRenderer implements NodeRenderer { readonly kind: "trail"; }
  class TrailBatcher implements Batcher {}
  ```

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `packages/nebula/test/TrailNodeRenderer.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { Bound, Vec2, Vec4 } from "@atlasjs/math";
import { TrailNode } from "../src/graphics/TrailNode";
import { TrailNodeRenderer } from "../src/renderers/TrailNodeRenderer";
import { TrailBatcher } from "../src/renderers/Batchers";
import type { TrailDrawCommand } from "../src/renderers/DrawCommand";
import type { RenderState, TrailBatch } from "../src/core";

const WIDE: Bound = new Bound(-10_000, -10_000, 20_000, 20_000);

type Entry = {
  posA: Vec2;
  posB: Vec2;
  edgeA: Vec2;
  edgeB: Vec2;
  colorA: Vec4;
  colorB: Vec4;
};

class RecordingTrailBatch implements TrailBatch {
  public readonly __kind: string = "test";
  public readonly entries: Entry[] = [];
  public renderState: RenderState = { blend: "alpha", depthTest: false, cull: "none" };

  public get count(): number {
    return this.entries.length;
  }

  public begin(renderState: RenderState): void {
    this.entries.length = 0;
    this.renderState = renderState;
  }

  public add(posA: Vec2, posB: Vec2, edgeA: Vec2, edgeB: Vec2, colorA: Vec4, colorB: Vec4): void {
    this.entries.push({ posA, posB, edgeA, edgeB, colorA, colorB });
  }

  public destroy(): void {}
}

function trailOf(points: ReadonlyArray<readonly [number, number]>): TrailNode {
  const node: TrailNode = new TrailNode();
  node.minVertexDistance = 1;
  node.time = 100;

  for (const [x, y] of points) {
    node.emit(x, y);
  }

  node.updateWorldMatrix();
  return node;
}

function collect(node: TrailNode, viewport: Bound = WIDE): TrailDrawCommand | null {
  return new TrailNodeRenderer().collect(node, viewport, new Bound()) as TrailDrawCommand | null;
}

function record(command: TrailDrawCommand): RecordingTrailBatch {
  const batch: RecordingTrailBatch = new RecordingTrailBatch();
  const batcher: TrailBatcher = new TrailBatcher(batch);

  batcher.begin(command);
  batcher.add(command);

  return batch;
}

describe("TrailNodeRenderer.collect", () => {
  it("ne dessine rien en dessous de deux points", () => {
    expect(collect(trailOf([]))).toBeNull();
    expect(collect(trailOf([[0, 0]]))).toBeNull();
  });

  it("produit une commande portant les points, tête en index 0", () => {
    const command: TrailDrawCommand | null = collect(trailOf([[0, 0], [10, 0], [20, 0]]));

    expect(command).not.toBeNull();
    const cmd: TrailDrawCommand = command as TrailDrawCommand;
    expect(cmd.kind).toBe("trail");
    expect(cmd.pointCount).toBe(3);
    expect(cmd.positions[0].x).toBe(20);
    expect(cmd.positions[2].x).toBe(0);
  });

  it("cull le trail hors du viewport", () => {
    const node: TrailNode = trailOf([[0, 0], [10, 0]]);
    expect(collect(node, new Bound(5_000, 5_000, 100, 100))).toBeNull();
  });

  it("porte la demi-largeur de départ sur le bord de la tête", () => {
    const node: TrailNode = trailOf([[0, 0], [10, 0], [20, 0]]);
    node.startWidth = 8;
    node.endWidth = 0;

    const cmd: TrailDrawCommand = collect(node) as TrailDrawCommand;

    expect(Math.hypot(cmd.edges[0].x, cmd.edges[0].y)).toBeCloseTo(4);
    expect(Math.hypot(cmd.edges[2].x, cmd.edges[2].y)).toBeCloseTo(0);
  });

  it("interpole la couleur de la tête vers la queue", () => {
    const node: TrailNode = trailOf([[0, 0], [10, 0], [20, 0]]);
    node.startColor.set(1, 0, 0, 1);
    node.endColor.set(0, 0, 1, 0);

    const cmd: TrailDrawCommand = collect(node) as TrailDrawCommand;

    expect(cmd.colors[0].x).toBeCloseTo(1);
    expect(cmd.colors[0].w).toBeCloseTo(1);
    expect(cmd.colors[2].z).toBeCloseTo(1);
    expect(cmd.colors[2].w).toBeCloseTo(0);
  });

  it("borne le miter sur un repli à 180 degrés, sans NaN", () => {
    const node: TrailNode = trailOf([[0, 0], [20, 0], [0, 0.001]]);
    node.startWidth = 10;
    node.endWidth = 10;

    const cmd: TrailDrawCommand = collect(node) as TrailDrawCommand;

    for (const edge of cmd.edges) {
      expect(Number.isFinite(edge.x)).toBe(true);
      expect(Number.isFinite(edge.y)).toBe(true);
      expect(Math.hypot(edge.x, edge.y)).toBeLessThanOrEqual(10.001);
    }
  });
});

describe("TrailBatcher", () => {
  it("émet un segment par paire de points consécutifs", () => {
    const cmd: TrailDrawCommand = collect(trailOf([[0, 0], [10, 0], [20, 0], [30, 0]])) as TrailDrawCommand;
    expect(record(cmd).entries).toHaveLength(3);
  });

  it("partage le bord du joint entre deux segments voisins", () => {
    const cmd: TrailDrawCommand = collect(trailOf([[0, 0], [20, 0], [20, 20]])) as TrailDrawCommand;
    const entries: Entry[] = record(cmd).entries;

    expect(entries).toHaveLength(2);
    expect(entries[0].edgeB).toBe(entries[1].edgeA);
    expect(entries[0].posB).toBe(entries[1].posA);
    expect(entries[0].colorB).toBe(entries[1].colorA);
  });
});
```

Le test « partage le bord du joint » utilise `toBe` (identité de référence) : c'est l'invariant d'étanchéité du design, et il ne peut pas être tenu par hasard.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

```bash
pnpm --filter @atlasjs/nebula test TrailNodeRenderer
```

Attendu : ÉCHEC — `TrailNodeRenderer` introuvable.

- [ ] **Step 3: Ajouter `TrailDrawCommand` et son `kindOrder`**

Dans `packages/nebula/src/renderers/DrawCommand.ts`, compléter l'import de `@atlasjs/math` avec `Vec2`, ajouter le type après `TileMapDrawCommand` et l'ajouter à l'union :

```ts
export type TrailDrawCommand = {
  readonly kind: "trail";
  readonly sortingLayer: number;
  readonly sortPrimary: number;
  readonly sortSecondary: number;
  readonly kindOrder: number;
  readonly batchKey: number;
  readonly renderState: RenderState;
  readonly positions: ReadonlyArray<Vec2>;
  readonly edges: ReadonlyArray<Vec2>;
  readonly colors: ReadonlyArray<Vec4>;
  readonly pointCount: number;
};

export type DrawCommand =
  | SpriteDrawCommand
  | ShapeDrawCommand
  | TileMapDrawCommand
  | TrailDrawCommand;
```

Dans `packages/nebula/src/renderers/NodeRenderer.ts`, `KIND_ORDER` est typé `Record<DrawCommand["kind"], number>` : TypeScript exige l'entrée.

```ts
export const KIND_ORDER: Record<DrawCommand["kind"], number> = {
  sprite: 0,
  shape: 1,
  tilemap: 2,
  trail: 3,
};
```

- [ ] **Step 4: Écrire `TrailNodeRenderer`**

Créer `packages/nebula/src/renderers/TrailNodeRenderer.ts` :

```ts
import { Bound, Vec2, Vec4 } from "@atlasjs/math";

import { Color } from "../utils";
import { Renderer } from "../core";
import { Node, TrailNode } from "../graphics";

import { TrailBatcher } from "./Batchers";
import { TrailDrawCommand } from "./DrawCommand";
import { NodeRendererBase } from "./NodeRendererBase";
import { NodeRenderer, Batcher, KIND_ORDER } from "./NodeRenderer";

type TrailRenderData = {
  readonly positions: Vec2[];
  readonly normals: Vec2[];
  readonly edges: Vec2[];
  readonly colors: Vec4[];
  batchKey: number;
};

const MAX_MITER: number = 2;
const EPSILON: number = 1e-6;

export class TrailNodeRenderer
  extends NodeRendererBase<TrailNode, TrailRenderData>
  implements NodeRenderer
{
  public readonly kind = "trail" as const;

  private nextBatchKey: number;

  public constructor() {
    super();
    this.nextBatchKey = 0;
  }

  public matches(node: Node): boolean {
    return node instanceof TrailNode;
  }

  public collect(
    node: Node,
    viewport: Bound,
    scratch: Bound,
  ): TrailDrawCommand | null {
    const trail: TrailNode = node as TrailNode;
    const count: number = trail.pointCount;

    if (count < 2) {
      return null;
    }

    const data: TrailRenderData = this.getOrCreateRenderData(trail);

    if (data.batchKey === -1) {
      data.batchKey = this.nextBatchKey++;
    }

    this.ensureCapacity(data, count);
    this.readPositions(trail, data, count);

    if (!viewport.overlaps(this.computeBound(trail, data, count, scratch))) {
      return null;
    }

    this.computeNormals(data, count);
    this.computeEdgesAndColors(trail, data, count);

    return {
      kind: "trail",
      sortingLayer: trail.sortingLayer,
      sortPrimary: trail.sortPrimary,
      sortSecondary: trail.sortSecondary,
      kindOrder: KIND_ORDER.trail,
      batchKey: data.batchKey,
      renderState: NodeRendererBase.RENDER_STATES[trail.blend],
      positions: data.positions,
      edges: data.edges,
      colors: data.colors,
      pointCount: count,
    };
  }

  public createBatcher(renderer: Renderer): Batcher {
    return new TrailBatcher(renderer.createTrailBatch());
  }

  protected createRenderData(): TrailRenderData {
    return { positions: [], normals: [], edges: [], colors: [], batchKey: -1 };
  }

  private ensureCapacity(data: TrailRenderData, count: number): void {
    while (data.positions.length < count) {
      data.positions.push(new Vec2());
      data.normals.push(new Vec2());
      data.edges.push(new Vec2());
      data.colors.push(new Vec4());
    }
  }

  private readPositions(
    trail: TrailNode,
    data: TrailRenderData,
    count: number,
  ): void {
    for (let i: number = 0; i < count; i++) {
      data.positions[i].set(trail.getPointX(i), trail.getPointY(i));
    }
  }

  private computeBound(
    trail: TrailNode,
    data: TrailRenderData,
    count: number,
    out: Bound,
  ): Bound {
    let minX: number = Infinity;
    let minY: number = Infinity;
    let maxX: number = -Infinity;
    let maxY: number = -Infinity;

    for (let i: number = 0; i < count; i++) {
      const point: Vec2 = data.positions[i];
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    const margin: number = Math.max(trail.startWidth, trail.endWidth) * 0.5;

    return out.set(
      minX - margin,
      minY - margin,
      maxX - minX + margin * 2,
      maxY - minY + margin * 2,
    );
  }

  private computeNormals(data: TrailRenderData, count: number): void {
    for (let i: number = 0; i < count - 1; i++) {
      const from: Vec2 = data.positions[i];
      const to: Vec2 = data.positions[i + 1];

      const dx: number = to.x - from.x;
      const dy: number = to.y - from.y;
      const length: number = Math.hypot(dx, dy);

      if (length <= EPSILON) {
        data.normals[i].set(0, 0);
        continue;
      }

      data.normals[i].set(-dy / length, dx / length);
    }
  }

  private computeEdgesAndColors(
    trail: TrailNode,
    data: TrailRenderData,
    count: number,
  ): void {
    const last: number = count - 1;

    for (let i: number = 0; i <= last; i++) {
      const t: number = i / last;
      const width: number =
        trail.startWidth + (trail.endWidth - trail.startWidth) * t;

      this.writeEdge(data, i, last, width * 0.5);
      this.writeColor(trail, data.colors[i], t);
    }
  }

  private writeEdge(
    data: TrailRenderData,
    index: number,
    last: number,
    halfWidth: number,
  ): void {
    const previous: Vec2 = data.normals[Math.max(0, index - 1)];
    const next: Vec2 = data.normals[Math.min(index, last - 1)];

    let mx: number = next.x;
    let my: number = next.y;

    if (index > 0 && index < last) {
      const sx: number = previous.x + next.x;
      const sy: number = previous.y + next.y;
      const length: number = Math.hypot(sx, sy);

      if (length > EPSILON) {
        const nx: number = sx / length;
        const ny: number = sy / length;
        const projection: number = nx * next.x + ny * next.y;
        const scale: number =
          projection > EPSILON ? Math.min(1 / projection, MAX_MITER) : MAX_MITER;

        mx = nx * scale;
        my = ny * scale;
      }
    }

    data.edges[index].set(mx * halfWidth, my * halfWidth);
  }

  private writeColor(trail: TrailNode, out: Vec4, t: number): void {
    const start: Color = trail.startColor;
    const end: Color = trail.endColor;

    out.set(
      start.r + (end.r - start.r) * t,
      start.g + (end.g - start.g) * t,
      start.b + (end.b - start.b) * t,
      start.a + (end.a - start.a) * t,
    );
  }
}
```

Le repli à 180° est couvert deux fois : `length <= EPSILON` sur la somme des normales (elles s'annulent) retombe sur la normale du segment suivant, et le clamp `MAX_MITER` borne l'allongement partout ailleurs.

- [ ] **Step 5: Écrire `TrailBatcher`**

Dans `packages/nebula/src/renderers/Batchers.ts` : compléter l'import du core avec `TrailBatch`, celui de `./DrawCommand` avec `TrailDrawCommand`, puis ajouter la classe à la fin du fichier.

```ts
export class TrailBatcher implements Batcher {
  private readonly batch: TrailBatch;

  public constructor(batch: TrailBatch) {
    this.batch = batch;
  }

  public begin(command: DrawCommand): void {
    const c: TrailDrawCommand = command as TrailDrawCommand;
    this.batch.begin(c.renderState);
  }

  public add(command: DrawCommand): void {
    const c: TrailDrawCommand = command as TrailDrawCommand;

    for (let i: number = 0; i < c.pointCount - 1; i++) {
      this.batch.add(
        c.positions[i],
        c.positions[i + 1],
        c.edges[i],
        c.edges[i + 1],
        c.colors[i],
        c.colors[i + 1],
      );
    }
  }

  public draw(renderer: Renderer): void {
    renderer.drawInstancedBatch(this.batch);
  }
}
```

- [ ] **Step 6: Enregistrer le renderer dans la scène**

Dans `packages/nebula/src/renderers/SceneRenderer.ts` : ajouter l'import et la quatrième entrée du tableau `nodeRenderers` (ligne 29-33). La boucle d'enregistrement des batchers juste en dessous n'a pas besoin de changer.

```ts
import { TrailNodeRenderer } from "./TrailNodeRenderer";
```

```ts
    this.nodeRenderers = [
      new SpriteRenderer(renderer),
      new ShapeRenderer(),
      new TileMapNodeRenderer(renderer),
      new TrailNodeRenderer(),
    ];
```

Dans `packages/nebula/src/renderers/index.ts`, ajouter :

```ts
export * from "./TrailNodeRenderer";
```

- [ ] **Step 7: Lancer les tests pour vérifier qu'ils passent**

```bash
pnpm --filter @atlasjs/nebula test TrailNodeRenderer
```

Attendu : 8 tests passés.

- [ ] **Step 8: Lancer toute la suite des deux packages (non-régression du tri et de la file)**

```bash
pnpm --filter @atlasjs/nebula test && pnpm --filter @atlasjs/nebula-webgpu test
```

Attendu : tout vert. `RenderQueue.test.ts` et `ShapeRenderer.test.ts` couvrent le tri et les commandes existantes — un `KIND_ORDER` cassé se verrait ici.

- [ ] **Step 9: Rebuild des dist**

```bash
pnpm --filter @atlasjs/nebula build && pnpm --filter @atlasjs/nebula-webgpu build
```

- [ ] **Step 10: Ajouter la démo dans `apps/webgpu`**

Dans `apps/webgpu/src/index.ts` : ajouter `TrailNode` à l'import depuis `@atlasjs/nebula`, puis, juste avant le `setInterval` existant (ligne 165), créer le trail :

```ts
  const trail: TrailNode = new TrailNode();
  trail.time = 0.6;
  trail.minVertexDistance = 4;
  trail.startWidth = 18;
  trail.endWidth = 0;
  trail.startColor.set(1, 0.85, 0.3, 1);
  trail.endColor.set(1, 0.2, 0.1, 0);
  trail.blend = "additive";
  nebula.scene.addChild(trail);

  globalThis.trail = trail;

  let trailClock: number = 0;
  let emitting: boolean = true;
  const TRAIL_DT: number = 1 / 60;
```

Remplacer le `setInterval` existant par :

```ts
  setInterval(() => {
    trailClock += TRAIL_DT;

    if (emitting) {
      const phase: number = trailClock * 1.6;
      trail.emit(
        320 + 220 * Math.cos(phase),
        240 + 150 * Math.sin(phase) * Math.cos(phase),
      );
    }

    trail.advance(TRAIL_DT);
    nebula.render();
  }, 1000 / 60);
```

Ajouter la bascule d'émission dans le `keydown` existant, pour valider l'extinction :

```ts
    if (event.code === "KeyT") {
      emitting = !emitting;
    }
```

Et déclarer le stash global à côté de `var animator` (bloc `declare global`, ligne 21) :

```ts
  var trail: TrailNode;
```

La lemniscate passe par deux points de rebroussement à forte courbure : c'est exactement là qu'un miter mal borné se verrait.

- [ ] **Step 11: Vérifier dans le navigateur**

Suivre la skill `atlas-verify-webgpu`. Démarrer le serveur via la config `webgpu` de `.claude/launch.json` (jamais via Bash), puis :

1. Screenshot : un ruban jaune→rouge qui suit un huit, **sans trou ni couture claire** dans les virages, et qui s'affine vers la queue.
2. Console : zéro erreur. Attention — une erreur de compilation WGSL **ne remonte pas** en erreur console ; si le canvas est noir, vérifier les logs du serveur et le message de compilation du shader.
3. Presser `T` : le ruban cesse de s'allonger et s'éteint par la queue en ~0,6 s, puis disparaît entièrement.
4. Dans la console : `trail.pointCount` doit retomber à 0 après l'extinction.

- [ ] **Step 12: Formater et stager**

```bash
pnpm exec prettier --write packages/nebula/src/renderers/TrailNodeRenderer.ts packages/nebula/src/renderers/Batchers.ts packages/nebula/src/renderers/DrawCommand.ts packages/nebula/src/renderers/NodeRenderer.ts packages/nebula/src/renderers/SceneRenderer.ts packages/nebula/src/renderers/index.ts packages/nebula/test/TrailNodeRenderer.test.ts apps/webgpu/src/index.ts
git add packages/nebula/src/renderers apps/webgpu/src/index.ts packages/nebula/test/TrailNodeRenderer.test.ts
```

Message de commit proposé :

```
feat(nebula): render trails as a mitered ribbon
```

---

### Task 4: Composant et système côté gameplay

**Files:**
- Create: `packages/gameplay/src/components/TrailRenderer.ts`
- Modify: `packages/gameplay/src/components/index.ts`
- Create: `packages/gameplay/src/systems/TrailRenderSystem.ts`
- Modify: `packages/gameplay/src/systems/index.ts`
- Modify: `packages/gameplay/src/GameplayPlugin.ts` (5 endroits : imports, `install`, `defineComponents`, `registerCleanup`, `registerSteps`, `uninstall`)
- Test: `packages/gameplay/test/trail-render-system.test.ts`

**Interfaces:**
- Consumes: `TrailNode` (Task 1), `WorldTransform2D`, `SortingLayers`, `applySortFields`, `SparseSet`, `NexusSystem`.
- Produces:
  ```ts
  interface TrailRendererOptions { time?, minVertexDistance?, startWidth?, endWidth?,
    startColor?, endColor?, emitting?, maxPoints?, blend?, visible?, sortingLayer?, sortingOrder? }
  class TrailRenderer { /* mêmes champs, tous requis et initialisés */ }
  class TrailRenderSystem implements NexusSystem {
    constructor(nebula: NebulaRenderer, sortingLayers: SortingLayers);
    update(context: NexusSystemContext): void;
    detach(entity: Entity): void;
    clear(): void;
  }
  ```

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `packages/gameplay/test/trail-render-system.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { Transform2D } from "@atlasjs/math";
import { NebulaRenderer, SceneGraph, TrailNode } from "@atlasjs/nebula";
import { Entity, NexusWorld } from "@atlasjs/nexus";
import { TrailRenderer, WorldTransform2D } from "../src/components";
import { TrailRenderSystem } from "../src/systems";
import { SortingLayers } from "../src/rendering";

const DT: number = 1 / 60;

function setup(): {
  world: NexusWorld;
  scene: SceneGraph;
  system: TrailRenderSystem;
} {
  const world: NexusWorld = new NexusWorld();
  world.defineComponent(WorldTransform2D).defineComponent(TrailRenderer);

  const scene: SceneGraph = new SceneGraph();
  const nebula: NebulaRenderer = { scene } as unknown as NebulaRenderer;

  return { world, scene, system: new TrailRenderSystem(nebula, new SortingLayers()) };
}

function mount(world: NexusWorld, x: number, y: number): Entity {
  const entity: Entity = world.createEntity();
  const transform: Transform2D = new Transform2D();
  transform.position.set(x, y);
  world.addComponent(entity, WorldTransform2D).matrix.fromTransform2D(transform);
  world.addComponent(entity, TrailRenderer, { minVertexDistance: 1, time: 0.1 });
  return entity;
}

function moveTo(world: NexusWorld, entity: Entity, x: number, y: number): void {
  const transform: Transform2D = new Transform2D();
  transform.position.set(x, y);
  world.requireComponent(entity, WorldTransform2D).matrix.fromTransform2D(transform);
}

function nodeOf(scene: SceneGraph): TrailNode {
  return scene.root.getChildren()[0] as TrailNode;
}

describe("TrailRenderSystem", () => {
  it("monte un TrailNode dans la scène au premier update", () => {
    const { world, scene, system } = setup();
    mount(world, 0, 0);

    expect(scene.root.getChildren()).toHaveLength(0);

    system.update({ world, dt: DT });

    expect(scene.root.getChildren()).toHaveLength(1);
    expect(nodeOf(scene)).toBeInstanceOf(TrailNode);
  });

  it("propage les molettes du composant sur le nœud", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, 0, 0);
    const component: TrailRenderer = world.requireComponent(entity, TrailRenderer);

    component.startWidth = 12;
    component.endWidth = 3;
    component.blend = "additive";
    component.maxPoints = 8;

    system.update({ world, dt: DT });

    const node: TrailNode = nodeOf(scene);
    expect(node.startWidth).toBe(12);
    expect(node.endWidth).toBe(3);
    expect(node.blend).toBe("additive");
    expect(node.capacity).toBe(8);
  });

  it("échantillonne la position du transform monde quand il émet", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, 0, 0);

    system.update({ world, dt: DT });
    moveTo(world, entity, 30, 0);
    system.update({ world, dt: DT });

    const node: TrailNode = nodeOf(scene);
    expect(node.pointCount).toBe(2);
    expect(node.getPointX(0)).toBe(30);
  });

  it("n'émet rien quand emitting est faux", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, 0, 0);
    world.requireComponent(entity, TrailRenderer).emitting = false;

    system.update({ world, dt: DT });
    moveTo(world, entity, 30, 0);
    system.update({ world, dt: DT });

    expect(nodeOf(scene).pointCount).toBe(0);
  });

  it("détache le trail à la mort de l'entité, le laisse s'éteindre puis quitte la scène", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, 0, 0);

    system.update({ world, dt: DT });
    moveTo(world, entity, 30, 0);
    system.update({ world, dt: DT });
    expect(nodeOf(scene).pointCount).toBe(2);

    system.detach(entity);
    world.destroyEntity(entity);

    expect(scene.root.getChildren()).toHaveLength(1);

    system.update({ world, dt: 0.05 });
    expect(scene.root.getChildren()).toHaveLength(1);

    system.update({ world, dt: 0.2 });
    expect(scene.root.getChildren()).toHaveLength(0);
  });

  it("clear retire les orphelins restants", () => {
    const { world, scene, system } = setup();
    const entity: Entity = mount(world, 0, 0);

    system.update({ world, dt: DT });
    system.detach(entity);
    system.clear();

    expect(scene.root.getChildren()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

```bash
pnpm --filter @atlasjs/gameplay test trail-render-system
```

Attendu : ÉCHEC — `TrailRenderer` et `TrailRenderSystem` n'existent pas.

- [ ] **Step 3: Écrire le composant**

Créer `packages/gameplay/src/components/TrailRenderer.ts` :

```ts
import { BlendMode, Color } from "@atlasjs/nebula";

export interface TrailRendererOptions {
  time?: number;
  minVertexDistance?: number;
  startWidth?: number;
  endWidth?: number;
  startColor?: Color;
  endColor?: Color;
  emitting?: boolean;
  maxPoints?: number;
  blend?: BlendMode;
  visible?: boolean;
  sortingLayer?: string;
  sortingOrder?: number;
}

export class TrailRenderer {
  public time: number;
  public minVertexDistance: number;
  public startWidth: number;
  public endWidth: number;
  public startColor: Color;
  public endColor: Color;
  public emitting: boolean;
  public maxPoints: number;
  public blend: BlendMode;
  public visible: boolean;
  public sortingLayer: string;
  public sortingOrder: number;

  public constructor(options?: TrailRendererOptions) {
    this.time = options?.time ?? 0.2;
    this.minVertexDistance = options?.minVertexDistance ?? 2;
    this.startWidth = options?.startWidth ?? 8;
    this.endWidth = options?.endWidth ?? 0;
    this.startColor = options?.startColor ?? new Color(1, 1, 1, 1);
    this.endColor = options?.endColor ?? new Color(1, 1, 1, 0);
    this.emitting = options?.emitting ?? true;
    this.maxPoints = options?.maxPoints ?? 64;
    this.blend = options?.blend ?? "alpha";
    this.visible = options?.visible ?? true;
    this.sortingLayer = options?.sortingLayer ?? "Default";
    this.sortingOrder = options?.sortingOrder ?? 0;
  }
}
```

Dans `packages/gameplay/src/components/index.ts`, ajouter dans l'ordre alphabétique — entre `./TileMapRenderer` et `./Transform2D` :

```ts
export * from "./TrailRenderer";
```

- [ ] **Step 4: Écrire le système**

Créer `packages/gameplay/src/systems/TrailRenderSystem.ts` :

```ts
import { Vec2 } from "@atlasjs/math";
import { Color, NebulaRenderer, TrailNode } from "@atlasjs/nebula";

import { TrailRenderer, WorldTransform2D } from "../components";
import { applySortFields } from "../rendering/applySortFields";
import type { SortingLayers } from "../rendering";

import {
  Entity,
  NexusSystem,
  NexusSystemContext,
  SparseSet,
} from "@atlasjs/nexus";

export class TrailRenderSystem implements NexusSystem {
  private readonly mounted: SparseSet<TrailNode>;
  private readonly detached: TrailNode[];
  private readonly nebula: NebulaRenderer;
  private readonly sortingLayers: SortingLayers;
  private readonly positionScratch: Vec2;

  public constructor(nebula: NebulaRenderer, sortingLayers: SortingLayers) {
    this.mounted = new SparseSet<TrailNode>();
    this.detached = [];
    this.nebula = nebula;
    this.sortingLayers = sortingLayers;
    this.positionScratch = new Vec2();
  }

  // prettier-ignore
  public update({ world, dt }: NexusSystemContext): void {
    world.query(WorldTransform2D, TrailRenderer).each((entity: Entity, worldTransform: WorldTransform2D, trailRenderer: TrailRenderer) => {
      const node: TrailNode = this.resolveNode(entity);
      const position: Vec2 = worldTransform.getPosition(this.positionScratch);

      this.sync(node, trailRenderer);

      if (trailRenderer.emitting) {
        node.emit(position.x, position.y);
      }

      node.advance(dt);

      applySortFields(
        node,
        this.sortingLayers,
        trailRenderer.sortingLayer,
        trailRenderer.sortingOrder,
        position.y,
      );
    });

    this.advanceDetached(dt);
  }

  public detach(entity: Entity): void {
    const node: TrailNode | undefined = this.mounted.get(entity);

    if (node === undefined) {
      return;
    }

    this.mounted.delete(entity);
    this.detached.push(node);
  }

  public clear(): void {
    for (let i: number = 0; i < this.detached.length; i++) {
      this.detached[i].removeFromParent();
    }

    this.detached.length = 0;
  }

  private advanceDetached(dt: number): void {
    for (let i: number = this.detached.length - 1; i >= 0; i--) {
      const node: TrailNode = this.detached[i];
      node.advance(dt);

      if (node.pointCount >= 2) {
        continue;
      }

      node.removeFromParent();
      this.detached[i] = this.detached[this.detached.length - 1];
      this.detached.pop();
    }
  }

  private sync(node: TrailNode, trailRenderer: TrailRenderer): void {
    const start: Color = trailRenderer.startColor;
    const end: Color = trailRenderer.endColor;

    node.time = trailRenderer.time;
    node.minVertexDistance = trailRenderer.minVertexDistance;
    node.startWidth = trailRenderer.startWidth;
    node.endWidth = trailRenderer.endWidth;
    node.startColor.set(start.r, start.g, start.b, start.a);
    node.endColor.set(end.r, end.g, end.b, end.a);
    node.blend = trailRenderer.blend;
    node.visible = trailRenderer.visible;
    node.setCapacity(trailRenderer.maxPoints);
  }

  private resolveNode(entity: Entity): TrailNode {
    const existing: TrailNode | undefined = this.mounted.get(entity);

    if (existing !== undefined) {
      return existing;
    }

    const node: TrailNode = new TrailNode();
    this.nebula.scene.addChild(node);
    this.mounted.set(entity, node);

    return node;
  }
}
```

Dans `packages/gameplay/src/systems/index.ts`, ajouter l'export dans l'ordre du fichier (après `TileMapRenderSystem`) :

```ts
export * from "./TrailRenderSystem";
```

- [ ] **Step 5: Lancer les tests du système**

```bash
pnpm --filter @atlasjs/gameplay test trail-render-system
```

Attendu : 6 tests passés.

- [ ] **Step 6: Câbler le plugin**

Cinq modifications dans `packages/gameplay/src/GameplayPlugin.ts` :

1. **Imports** — ajouter `TrailRenderSystem` au bloc d'import depuis `./systems` (ligne 26-35, ordre alphabétique après `TileMapRenderSystem`) et `TrailRenderer` au bloc depuis `./components` (ligne 37-54, après `TileMapRenderer`).

2. **Champ de classe** — après `private scriptManager!: ScriptManager;` (ligne 61), le système doit survivre jusqu'à `uninstall` :

```ts
  private trailRenderSystem?: TrailRenderSystem;
```

3. **`install`** — après la construction d'`occluderRenderSystem` (ligne 101) :

```ts
    const trailRenderSystem: TrailRenderSystem = new TrailRenderSystem(nebula, sortingLayers);
    this.trailRenderSystem = trailRenderSystem;
```

Puis passer `trailRenderSystem` en dernier argument de `this.registerCleanup(...)` (ligne 109) et de `this.registerSteps(...)` (ligne 124), et compléter les deux signatures avec `trailRenderSystem: TrailRenderSystem`.

4. **`defineComponents`** — ajouter le maillon avant `.defineComponent(OccluderStrip)` :

```ts
      .defineComponent(TrailRenderer)
```

5. **`registerCleanup`** — ajouter dans le tableau `this.unsubscribers.push(...)`, juste après le handler `OccluderStrip` :

```ts
      world.onRemove(TrailRenderer, (entity: Entity) => {
        trailRenderSystem.detach(entity);
      }),
```

6. **`registerSteps`** — après le bloc `gameplay:occluder-render` :

```ts
    this.handles.push(
      registerSystem(render, world, trailRenderSystem, {
        name: "gameplay:trail-render",
        stage: "PreRender",
        after: "gameplay:occluder-render",
      }),
    );
```

7. **`uninstall`** — avant `this.scriptManager.dispose();` :

```ts
    this.trailRenderSystem?.clear();
```

- [ ] **Step 7: Lancer toute la suite gameplay + le type-check**

```bash
pnpm --filter @atlasjs/gameplay test && pnpm --filter @atlasjs/gameplay typecheck
```

Attendu : tout vert. Un `registerCleanup`/`registerSteps` mal complété casse le type-check ici.

- [ ] **Step 8: Rebuild du dist**

```bash
pnpm --filter @atlasjs/gameplay build
```

- [ ] **Step 9: Formater et stager**

```bash
pnpm exec prettier --write packages/gameplay/src/components/TrailRenderer.ts packages/gameplay/src/components/index.ts packages/gameplay/src/systems/TrailRenderSystem.ts packages/gameplay/src/systems/index.ts packages/gameplay/src/GameplayPlugin.ts packages/gameplay/test/trail-render-system.test.ts
git add packages/gameplay/src packages/gameplay/test/trail-render-system.test.ts
```

Message de commit proposé :

```
feat(gameplay): add the TrailRenderer component and system
```

---

### Task 5: Le trail du rappier dans dino-brawl

C'est la validation en usage réel : trail court sur la pointe de la lame, allumé uniquement pendant le swing.

**Files:**
- Modify: `apps/dino-brawl/src/game/prefabs/weapon/SwordPrefab.ts`
- Modify: `apps/dino-brawl/src/game/scripts/weapon/SwordScript.ts`
- Test: `apps/dino-brawl/test/game/scripts/weapon/swordScript.test.ts`

**Interfaces:**
- Consumes: `TrailRenderer` + `TrailRendererOptions` (Task 4), `EntityBuilder.child()`, `Transform2D`.
- Produces: `SwordScriptProps.trail: TrailRenderer` (requis), déclaré dans les métadonnées du script.

- [ ] **Step 1: Écrire le test qui échoue**

Dans `apps/dino-brawl/test/game/scripts/weapon/swordScript.test.ts`, ajouter l'injection par défaut dans `createRig`, juste avant la boucle `for (const key of Object.keys(overrides))` :

```ts
  injected.trail = { emitting: false };
```

Puis ajouter ce bloc `describe` à la fin du fichier :

```ts
describe("SwordScript trail", () => {
  it("allume le trail au départ du swing", () => {
    const trail: { emitting: boolean } = { emitting: false };
    const rig: Rig = createRig({ trail });

    rig.swing();

    expect(trail.emitting).toBe(true);
  });

  it("éteint le trail quand le swing arrive à son terme", () => {
    const trail: { emitting: boolean } = { emitting: true };
    const rig: Rig = createRig({ trail, attackDuration: DT });

    rig.frame();

    expect(trail.emitting).toBe(false);
  });
});
```

Le second test s'appuie sur l'état `"attacking"` que `createRig` pose en sortie, et sur `attackDuration` surchargé à un seul `DT` : la première frame atteint donc la fin de l'attaque.

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
pnpm --filter dino-brawl test swordScript
```

Attendu : ÉCHEC — `trail.emitting` reste à sa valeur initiale (le script n'y touche pas encore).

- [ ] **Step 3: Brancher le trail dans `SwordScript`**

Dans `apps/dino-brawl/src/game/scripts/weapon/SwordScript.ts` :

1. Ajouter `TrailRenderer` à l'import depuis `@atlasjs/gameplay` (c'est une **classe**, donc un import de valeur, pas `import type`).

2. Dans `SwordScriptProps` (ligne 22-31), après `hitbox` :

```ts
  trail: TrailRenderer;
```

3. Dans les champs de la classe, après `private readonly hitbox: SwordHitboxScript;` :

```ts
  private readonly trail: TrailRenderer;
```

4. Dans `startAttack()` (ligne 176), après `this.state = "attacking";` :

```ts
    this.trail.emitting = true;
```

5. Dans le bloc de fin d'attaque (ligne 158-160) :

```ts
    if (this.attackClock >= this.attackDuration) {
      this.state = "idle";
      this.trail.emitting = false;
    }
```

6. Dans `registerScriptMetadata` (ligne 243), après `hitbox` :

```ts
    trail: ScriptMetadata.field({ required: true }),
```

- [ ] **Step 4: Créer l'entité de pointe dans le prefab**

Dans `apps/dino-brawl/src/game/prefabs/weapon/SwordPrefab.ts` :

1. Ajouter `TrailRenderer` et `Color` à l'import depuis `@atlasjs/gameplay`, en gardant `type EntityBuilder` en import de type.

2. Dans le builder du sprite d'épée, **avant** l'appel `e.attach(SwordScript, {...})`, créer l'enfant de pointe et capturer son composant :

```ts
        let trail!: TrailRenderer;

        e.child((tip: EntityBuilder): void => {
          tip.add(Transform2D).position.set(44, -44);

          trail = tip.add(TrailRenderer, {
            time: 0.14,
            minVertexDistance: 3,
            startWidth: 10,
            endWidth: 0,
            startColor: new Color(1, 1, 1, 0.9),
            endColor: new Color(0.6, 0.85, 1, 0),
            emitting: false,
            maxPoints: 24,
            blend: "additive",
            sortingLayer: SortingLayer.Entities,
            sortingOrder: SortingOrder.SwordFront,
          });
        });
```

`child()` exécute son callback de façon synchrone, donc `trail` est affecté avant le `attach`.

3. Passer le composant au script, dans l'objet de props de `e.attach(SwordScript, {...})`, après `hitbox` :

```ts
          trail,
```

L'offset `(44, -44)` place la pointe au bout de la lame, dans le repère du sprite d'épée dont le pivot est `(0, 1)` et l'échelle `1.2` — à ajuster à l'œil à l'étape de vérification navigateur.

- [ ] **Step 5: Lancer les tests et le type-check de l'app**

```bash
pnpm --filter dino-brawl test swordScript
```

Attendu : les 2 nouveaux tests passent, les anciens restent verts.

```bash
pnpm --filter dino-brawl exec tsc --noEmit -p tsconfig.app.json
```

Attendu : aucune erreur. **`tsc --noEmit` sans `-p tsconfig.app.json` ne vérifie rien dans cette app.**

- [ ] **Step 6: Lancer toute la suite dino-brawl**

```bash
pnpm --filter dino-brawl test
```

Attendu : tout vert.

- [ ] **Step 7: Vérifier dans le navigateur**

Suivre `atlas-verify-webgpu`. Démarrer la config `dino-brawl` de `.claude/launch.json`, puis :

1. Attaquer (clic gauche) et prendre un screenshot **pendant** le swing : une traînée claire suit la pointe de la lame et s'estompe derrière elle.
2. Vérifier qu'elle **disparaît entre deux attaques** — pas de ruban résiduel au repos.
3. Enchaîner le combo complet : la traînée se rallume à chaque coup, sans accumuler de segments parasites.
4. Console : zéro erreur ; le canvas ne doit pas être noir (une erreur de compilation WGSL ne remonte pas en console).
5. Si la traînée part du manche plutôt que de la pointe, ajuster l'offset `(44, -44)` de l'étape 4 et re-vérifier.

- [ ] **Step 8: Formater et stager**

```bash
pnpm exec prettier --write apps/dino-brawl/src/game/prefabs/weapon/SwordPrefab.ts apps/dino-brawl/src/game/scripts/weapon/SwordScript.ts apps/dino-brawl/test/game/scripts/weapon/swordScript.test.ts
git add apps/dino-brawl/src/game/prefabs/weapon/SwordPrefab.ts apps/dino-brawl/src/game/scripts/weapon/SwordScript.ts apps/dino-brawl/test/game/scripts/weapon/swordScript.test.ts
```

Message de commit proposé :

```
feat(dino-brawl): add a trail to the rappier
```

---

## Clôture

Une fois les 5 tâches livrées et vérifiées :

1. Passer le statut de [`docs/rendering/trails.md`](../rendering/trails.md) à **implémenté**, avec la date.
2. Créer les notes de backlog des suites listées en §10 du design (trails texturés, caps ronds, courbes de largeur, packing multi-trails, `AfterimageRenderer`).
3. `pnpm docs:index` pour régénérer l'index.
4. Supprimer ce plan — les plans de `docs/plans/` sont transitoires (`/atlas-done` s'en charge).
