# Debug Gizmos — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre visibles à l'exécution les colliders (contour rectangulaire / anneau) et les origines d'entité (disque), via des composants opt-in et un switch global, sans jamais mentir sur la géométrie réelle de la physique.

**Architecture:** Un nouveau package plugin `@atlasjs/gizmos` expose un service `Gizmos` en **immediate-mode** (deux méthodes de dessin) adossé à un **pool de nœuds nebula recyclés**, vidé par un unique step `gizmos:flush` en fin de lane `render`/`PreRender`. Deux systèmes produisent dedans : `ColliderGizmoSystem` (lit `PhysicsColliderRef` pour la position et `Collider2D.shape` pour les extents **non scalés**) et `PivotGizmoSystem` (lit `WorldTransform2D`). Le contour lui-même est une nouvelle capacité de `@atlasjs/nebula` : `ShapeNode.borderWidth` → `params.y` de l'instance → SDF de contour en WGSL.

**Tech Stack:** TypeScript 5.9, pnpm workspaces + Turborepo, vitest (env node), tsdown, WebGPU / WGSL.

**Spec de référence :** [`docs/debug/gizmos.md`](gizmos.md). En cas de contradiction, le spec gagne.

## Global Constraints

- **Le gizmo ne mentit jamais.** Position et rotation viennent de `PhysicsColliderRef` (vérité rapier) ; les extents viennent de `Collider2D.shape` et ne sont **jamais** multipliés par `Transform2D.scale` (la physique ne l'applique pas). Aucun collider sans `PhysicsColliderRef` n'est dessiné, et aucune forme non supportée n'est approximée.
- **Tout typer**, même trivialement : paramètres de fonction, variables locales, champs de classe (règle du `CLAUDE.md` racine).
- **Aucun commentaire** ajouté dans le code (règle du `CLAUDE.md` racine). Les commentaires présents dans les blocs de code de ce plan sont pédagogiques : **ne pas les recopier**.
- **Pas de dépendance circulaire.** `@atlasjs/gizmos` dépend de `gameplay` / `inertia` / `nebula` ; aucun de ces packages n'apprend l'existence de `gizmos`.
- **Prettier avant staging**, uniquement sur les fichiers `.ts`/`.tsx` touchés (jamais `--write` sur tout le repo, jamais sur les `.md` : `docs/*.md` n'est pas maintenu par prettier dans ce repo).
- **AUCUN COMMIT.** Les subagents implémentent, testent, formatent et `git add` — jamais `git commit`, `git rebase`, `git reset` ni `git checkout` de branche. L'utilisateur commite chaque tâche lui-même, et il édite parfois au moment du commit : le contrôleur relance les tests de la tâche sur l'état commité avant d'enchaîner.
- Valeurs par défaut du `GizmoSettings`, verbatim : `showColliders = false`, `showPivots = false`, `colliderColor = (0, 1, 0, 1)`, `sensorColor = (0, 1, 1, 1)`, `pivotColor = (1, 0, 1, 1)`, `pivotRadius = 2`, `borderWidth = 1`.
- `GIZMO_SORTING_LAYER = 1_000_000`.
- **Piège de nommage :** `Transform2D` existe dans **deux** packages — `@atlasjs/math` (valeurs TRS brutes, utilisé par `Mat3.fromTransform2D`) et `@atlasjs/gameplay` (le composant ECS). Les tests utilisent celui de **math** pour fabriquer un `WorldTransform2D`.

---

## File Structure

**Créés :**

| Fichier | Responsabilité |
|---|---|
| `packages/gizmos/package.json` | manifeste du package |
| `packages/gizmos/tsconfig.json` | étend `tsconfig.base.json` |
| `packages/gizmos/tsdown.config.ts` | build ESM + dts |
| `packages/gizmos/vitest.config.ts` | vitest + les `define` de globals attendus par `@atlasjs/utils` |
| `packages/gizmos/src/index.ts` | surface publique |
| `packages/gizmos/src/tokens.ts` | token de service `GIZMOS` |
| `packages/gizmos/src/GizmoSettings.ts` | politique des gizmos built-in + type d'options |
| `packages/gizmos/src/NodeRing.ts` | anneau générique de nœuds recyclés + `GIZMO_SORTING_LAYER` |
| `packages/gizmos/src/GizmoNodePool.ts` | agrège un anneau par type de nœud et fan-out le cycle de frame |
| `packages/gizmos/src/Gizmos.ts` | service : `settings` + API immediate-mode |
| `packages/gizmos/src/GizmoPlugin.ts` | câblage : composants, systèmes, steps, service |
| `packages/gizmos/src/components/ColliderGizmo.ts` | marqueur + override de couleur |
| `packages/gizmos/src/components/PivotGizmo.ts` | marqueur + overrides couleur/rayon |
| `packages/gizmos/src/systems/ColliderGizmoSystem.ts` | producteur des gizmos de collider |
| `packages/gizmos/src/systems/PivotGizmoSystem.ts` | producteur des gizmos d'origine |
| `packages/nebula/test/ShapeRenderer.test.ts` | `params.y` porte le `borderWidth` |
| `packages/gizmos/test/gizmo-pool.test.ts` | pool : recyclage, masquage, reset, tri |
| `packages/gizmos/test/collider-gizmo-system.test.ts` | les règles du § 2 du spec, en exécutable |
| `packages/gizmos/test/pivot-gizmo-system.test.ts` | disque à l'origine, rempli |
| `packages/gizmos/test/gizmo-plugin.test.ts` | service fourni, steps ordonnés, teardown |

**Modifiés :**

| Fichier | Modification |
|---|---|
| `packages/nebula/src/graphics/ShapeNode.ts` | `+ borderWidth: number` (défaut `0`) et `setBorderWidth()` |
| `packages/nebula/src/renderers/ShapeRenderer.ts` | `data.params.set(kind, shape.borderWidth, 0, 0)` |
| `packages/nebula-webgpu/src/shaders/shape_instanced.wgsl` | `halfSize` dérivé de la matrice + SDF de contour |
| `apps/webgpu/src/index.ts` | démo : un rect stroké, un anneau, et les fills existants côte à côte |
| `apps/dino-brawl/package.json` | `+ "@atlasjs/gizmos": "workspace:*"` |
| `apps/dino-brawl/src/app/GameCanvas.tsx` | `engine.use(new GizmoPlugin({ showColliders: true }))` |
| `CLAUDE.md` | index des docs : nouvelle section `docs/debug/` |
| `docs/backlog.md` | items V2 des gizmos + clôture de « strokes / contours » |

---

## Task 1 : Stroke dans nebula + WGSL

Première tâche parce que tout le reste en dépend visuellement, et parce qu'une erreur de syntaxe WGSL casse le rendu entier — mieux vaut la localiser ici.

**Files:**
- Modify: `packages/nebula/src/graphics/ShapeNode.ts`
- Modify: `packages/nebula/src/renderers/ShapeRenderer.ts` (méthode `buildCommand`, ligne `data.params.set(kind, 0, 0, 0);`)
- Modify: `packages/nebula-webgpu/src/shaders/shape_instanced.wgsl`
- Modify: `apps/webgpu/src/index.ts`
- Test: `packages/nebula/test/ShapeRenderer.test.ts`

**Interfaces:**
- Consumes: rien (première tâche).
- Produces:
  - `ShapeNode.borderWidth: number` — défaut `0`, unités monde.
  - `ShapeNode.setBorderWidth(width: number): this`
  - Contrat d'instance : `params = (shapeKind, borderWidth, 0, 0)`. `borderWidth = 0` ⇒ rempli.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `packages/nebula/test/ShapeRenderer.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { Bound } from "@atlasjs/math";
import { CircleNode } from "../src/graphics/CircleNode";
import { RectNode } from "../src/graphics/RectNode";
import { ShapeRenderer } from "../src/renderers/ShapeRenderer";
import type { ShapeDrawCommand } from "../src/renderers/DrawCommand";
import type { ShapeNode } from "../src/graphics/ShapeNode";

function collect(node: ShapeNode): ShapeDrawCommand {
  node.updateWorldMatrix();

  const renderer: ShapeRenderer = new ShapeRenderer();
  const viewport: Bound = new Bound(-10_000, -10_000, 20_000, 20_000);
  const command: ShapeDrawCommand | null = renderer.collect(
    node,
    viewport,
    new Bound(),
  ) as ShapeDrawCommand | null;

  expect(command).not.toBeNull();
  return command as ShapeDrawCommand;
}

describe("ShapeRenderer — borderWidth", () => {
  it("laisse params.y à 0 sur un rect par défaut (non-régression du fill)", () => {
    const command: ShapeDrawCommand = collect(new RectNode(40, 40));
    expect(command.params.y).toBe(0);
  });

  it("laisse params.y à 0 sur un cercle par défaut", () => {
    const command: ShapeDrawCommand = collect(new CircleNode(20));
    expect(command.params.y).toBe(0);
  });

  it("porte le borderWidth d'un rect dans params.y", () => {
    const node: RectNode = new RectNode(40, 40);
    node.setBorderWidth(2);
    expect(collect(node).params.y).toBe(2);
  });

  it("porte le borderWidth d'un cercle dans params.y sans toucher shapeKind", () => {
    const node: CircleNode = new CircleNode(20);
    node.setBorderWidth(1.5);

    const command: ShapeDrawCommand = collect(node);
    expect(command.params.y).toBe(1.5);
    expect(command.params.x).toBe(1);
  });

  it("expose borderWidth = 0 par défaut sur le nœud", () => {
    expect(new RectNode(10, 10).borderWidth).toBe(0);
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
pnpm --filter @atlasjs/nebula test -- ShapeRenderer
```

Attendu : ÉCHEC. Les deux premiers cas peuvent passer (`params.y` vaut déjà `0`), mais les cas `setBorderWidth` échouent à la compilation TypeScript — `Property 'setBorderWidth' does not exist on type 'RectNode'`.

- [ ] **Step 3 : Ajouter `borderWidth` à `ShapeNode`**

Dans `packages/nebula/src/graphics/ShapeNode.ts`, ajouter le champ et le setter. Fichier complet après modification :

```ts
import { BlendMode } from "../core";
import { Color } from "../utils";
import { Node } from "./Node";

export class ShapeNode extends Node {
  public color: Color;
  public blend: BlendMode;
  public borderWidth: number;

  public constructor() {
    super();
    this.color = new Color(1, 1, 1, 1);
    this.blend = "alpha";
    this.borderWidth = 0;
  }

  public setColor(r: number, g: number, b: number, a: number = 1): this {
    this.color.set(r, g, b, a);
    return this;
  }

  public setBlend(blend: BlendMode): this {
    this.blend = blend;
    return this;
  }

  public setBorderWidth(width: number): this {
    this.borderWidth = width;
    return this;
  }
}
```

- [ ] **Step 4 : Câbler `params.y` dans `ShapeRenderer`**

Dans `packages/nebula/src/renderers/ShapeRenderer.ts`, méthode `buildCommand`, remplacer :

```ts
    data.params.set(kind, 0, 0, 0);
```

par :

```ts
    data.params.set(kind, shape.borderWidth, 0, 0);
```

C'est la seule ligne à changer dans ce fichier.

- [ ] **Step 5 : Lancer le test pour vérifier qu'il passe**

```bash
pnpm --filter @atlasjs/nebula test -- ShapeRenderer
```

Attendu : PASS, 5 tests.

- [ ] **Step 6 : Vérifier la non-régression du reste de nebula**

```bash
pnpm --filter @atlasjs/nebula test
```

Attendu : toute la suite nebula au vert. `params` étant déjà un `vec4`, aucun layout ne change et `RenderQueue`/`NodeRendererBase` ne sont pas concernés.

- [ ] **Step 7 : Réécrire le shader**

Remplacer intégralement `packages/nebula-webgpu/src/shaders/shape_instanced.wgsl` par :

```wgsl
struct Instance {
  model: mat4x4<f32>,
  color: vec4<f32>,
  params: vec4<f32>,
};

@group(1) @binding(0)
var<storage, read> instances: array<Instance>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) localPos: vec2<f32>,
  @location(1) color: vec4<f32>,
  @location(2) params: vec4<f32>,
  @location(3) halfSize: vec2<f32>,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  var positions = array<vec2<f32>, 6>(
    vec2<f32>(-0.5,  0.5),
    vec2<f32>( 0.5,  0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>( 0.5,  0.5),
    vec2<f32>( 0.5, -0.5),
  );

  let instance = instances[instanceIndex];
  let corner = positions[vertexIndex];

  let sx: f32 = length(instance.model[0].xyz);
  let sy: f32 = length(instance.model[1].xyz);

  var out: VertexOutput;
  out.localPos = corner;
  out.color = instance.color;
  out.params = instance.params;
  out.halfSize = vec2<f32>(sx, sy) * 0.5;
  out.position =
    uGlobal.viewProjection * instance.model * vec4<f32>(corner, 0.0, 1.0);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let isCircle: bool = in.params.x > 0.5;
  let border: f32 = in.params.y;
  
  let p: vec2<f32> = in.localPos * in.halfSize * 2.0;
  
  let circleDist: f32 = length(p) - in.halfSize.x;
  let q: vec2<f32> = abs(p) - in.halfSize;
  let rectDist: f32 = length(max(q, vec2<f32>(0.0))) + min(max(q.x, q.y), 0.0);
  let d: f32 = select(rectDist, circleDist, isCircle);
  
  let aa: f32 = max(fwidth(d), 1e-5);
  let outer: f32 = 1.0 - smoothstep(-aa, 0.0, d);
  let inner: f32 = smoothstep(-aa, 0.0, d + border);
  let stroked: f32 = select(outer, outer * inner, border > 0.0);
  let coverage: f32 = select(stroked, 1.0, !isCircle && border <= 0.0);

  return vec4<f32>(in.color.rgb, in.color.a * coverage);
}
```

Trois points à ne pas « simplifier » :

1. **Aucun `if` dépendant de `params` avant `fwidth`.** `fwidth` est un builtin de dérivée : WGSL interdit de l'appeler depuis du contrôle de flux non-uniforme. `in.params` est un attribut interpolé, donc un `if`/`return` anticipé qui en dépend fait **échouer la compilation** — `error: 'fwidth' must only be called from uniform control flow`. D'où les `select` : les deux SDF et la dérivée sont calculées inconditionnellement, les décisions sont des `select`. Coût : quelques ALU par fragment. Ne pas « optimiser » en réintroduisant des branches.
2. **Le `select(stroked, 1.0, !isCircle && border <= 0.0)` final est obligatoire.** Le rect plein n'a aucune marge d'AA : sa géométrie *est* le quad. Au bord, `localPos = ±0.5` ⇒ `q = 0` ⇒ `d = 0` ⇒ `coverage = 0`. Sans ce court-circuit, tous les rects pleins existants perdent leur rang de pixels extérieur.
3. **`uGlobal` vient de `global.wgsl`** et est injecté à la compilation — ne pas le redéclarer ici.

- [ ] **Step 8 : Ajouter la démo dans `apps/webgpu`**

Lire d'abord `apps/webgpu/src/index.ts` pour suivre son style de scène, puis ajouter quatre nœuds côte à côte, de façon à ce qu'une seule capture prouve tout :

```ts
const filledRect: RectNode = new RectNode(80, 80);
filledRect.setPosition(-150, 0).setColor(1, 1, 1, 1);

const strokedRect: RectNode = new RectNode(80, 80);
strokedRect.setPosition(-50, 0).setColor(0, 1, 0, 1).setBorderWidth(3);

const filledCircle: CircleNode = new CircleNode(40);
filledCircle.setPosition(50, 0).setColor(1, 1, 1, 1);

const ring: CircleNode = new CircleNode(40);
ring.setPosition(150, 0).setColor(0, 1, 1, 1).setBorderWidth(3);
```

- [ ] **Step 9 : Vérification navigateur (le WGSL n'est pas testable en node)**

**D'abord rebuilder le backend** — c'est le piège qui coûte le plus de temps ici :

```bash
pnpm --filter @atlasjs/nebula-webgpu build
```

`apps/webgpu` importe `@atlasjs/nebula-webgpu` par son `exports` (`./dist/index.mjs`), et le `.wgsl` est **inliné dans `dist` au build**. Éditer `src/shaders/*.wgsl` sans rebuilder laisse le navigateur servir l'ancien shader — y compris après un redémarrage du serveur de dev. À refaire après **chaque** modification de shader.

Démarrer ensuite le serveur de dev de `apps/webgpu` via `preview_start` (jamais via Bash), puis prendre une capture.

Deux pièges d'environnement observés : (1) le port annoncé par le harness peut différer de celui que Vite choisit réellement (lire `preview_logs` et naviguer sur le port de Vite) ; (2) une erreur de compilation WGSL n'apparaît **pas** comme `error` console mais comme `warn` (`Error while parsing WGSL:` puis des `Invalid RenderPipeline … due to a previous error` répétés à 60 fps qui noient le message d'origine) — lire la console **sans** `onlyErrors`. Pour obtenir l'erreur exacte à coup sûr, compiler le shader dans la page et lire `getCompilationInfo()`.

Attendu, dans l'ordre de gauche à droite :

1. **Rect plein blanc** — bords **nets**, aucun liseré ni dégradé sur le pourtour. C'est l'assertion de non-régression la plus importante de cette tâche.
2. **Rect vert en contour** — 4 côtés d'épaisseur visuellement égale (c'est ça que valide la dérivation de `halfSize` : une épaisseur en espace local aurait donné des côtés d'épaisseurs différentes sur un rect non carré — refaire le test avec `new RectNode(120, 40)` si un doute subsiste).
3. **Disque plein blanc** — bord antialiasé, identique à avant le changement.
4. **Anneau cyan** — épaisseur régulière sur tout le tour, centre transparent.
5. **Rect stroké non carré (160×60)** — le test décisif de la dérivation de `halfSize`.

**Mesurer plutôt que juger à l'œil** : la capture est réduite et le crop de zoom n'est pas supporté dans ce panneau. Dessiner le canvas dans un canvas 2D (`drawImage`) et échantillonner les pixels via `javascript_tool` :

- sur le rect non carré, les runs de pixels allumés le long d'une scanline horizontale **et** verticale doivent avoir la **même longueur** (à dpr 2 et `borderWidth = 3` : 7 px de chaque côté). Des côtés verticaux ~2,7× plus épais que les horizontaux signifient que l'épaisseur est restée en espace quad local ;
- sur le rect plein, la transition de bord doit se faire en **un seul pixel** (0 → 255), sans valeur intermédiaire : c'est la preuve de non-régression du fill.

- [ ] **Step 10 : Formater et stager (NE PAS COMMITER)**

```bash
npx prettier --write packages/nebula/src/graphics/ShapeNode.ts packages/nebula/src/renderers/ShapeRenderer.ts packages/nebula/test/ShapeRenderer.test.ts
git add packages/nebula/src/graphics/ShapeNode.ts packages/nebula/src/renderers/ShapeRenderer.ts packages/nebula/test/ShapeRenderer.test.ts packages/nebula-webgpu/src/shaders/shape_instanced.wgsl apps/webgpu
git status --short
```

Message de commit suggéré, à laisser à l'utilisateur : `feat(nebula): stroke support on shape nodes via SDF border`

---

## Task 2 : Package `@atlasjs/gizmos` — service, pool, plugin

**Files:**
- Create: `packages/gizmos/package.json`, `packages/gizmos/tsconfig.json`, `packages/gizmos/tsdown.config.ts`, `packages/gizmos/vitest.config.ts`
- Create: `packages/gizmos/src/index.ts`, `src/tokens.ts`, `src/GizmoSettings.ts`, `src/NodeRing.ts`, `src/GizmoNodePool.ts`, `src/Gizmos.ts`, `src/GizmoPlugin.ts`
- Create: `packages/gizmos/src/components/ColliderGizmo.ts`, `src/components/PivotGizmo.ts`
- Test: `packages/gizmos/test/gizmo-pool.test.ts`, `packages/gizmos/test/gizmo-plugin.test.ts`

**Interfaces:**
- Consumes (Task 1) : `ShapeNode.setBorderWidth(width: number): this`.
- Produces :
  - `GIZMO_SORTING_LAYER: number` = `1_000_000` — exporté depuis `NodeRing.ts`
  - `class GizmoSettings` — champs du § Global Constraints ; `constructor(options?: GizmoPluginOptions)`
  - `type GizmoPluginOptions = Partial<GizmoSettings>`
  - `class NodeRing<T extends ShapeNode>` — `constructor(nebula: NebulaRenderer, create: () => T)`, `acquire(): T`, `hideUnused(): void`, `reset(): void`, `dispose(): void`
  - `class GizmoNodePool` — `constructor(nebula: NebulaRenderer)`, `acquireRect(): RectNode`, `acquireCircle(): CircleNode`, `hideUnused(): void`, `reset(): void`, `dispose(): void`
  - `class Gizmos` — `readonly settings: GizmoSettings`, `readonly color: Color`, `borderWidth: number`, `drawRect(x, y, width, height, rotation): void`, `drawCircle(x, y, radius): void`
  - `class ColliderGizmo { color: Color | null }`
  - `class PivotGizmo { color: Color | null; radius: number | null }`
  - `GIZMOS: ServiceToken<Gizmos>`
  - `class GizmoPlugin extends Plugin` — `constructor(options?: GizmoPluginOptions)`
  - Noms de steps : `"gizmos:collider"`, `"gizmos:pivot"`, `"gizmos:flush"` (lane `render`, stage `PreRender`)

- [ ] **Step 1 : Créer les 4 fichiers de configuration du package**

`packages/gizmos/package.json` :

```json
{
  "name": "@atlasjs/gizmos",
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
    "@atlasjs/core": "workspace:*",
    "@atlasjs/gameplay": "workspace:*",
    "@atlasjs/inertia": "workspace:*",
    "@atlasjs/math": "workspace:*",
    "@atlasjs/nebula": "workspace:*",
    "@atlasjs/nexus": "workspace:*",
    "@atlasjs/utils": "workspace:*"
  }
}
```

`packages/gizmos/tsconfig.json` :

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

`packages/gizmos/tsdown.config.ts` :

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

`packages/gizmos/vitest.config.ts` — le bloc `define` n'est pas décoratif : `@atlasjs/utils` (`createLogger`) référence ces globals et les tests plantent sans eux.

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

- [ ] **Step 2 : Installer les dépendances du workspace**

```bash
pnpm install
```

Attendu : `pnpm-workspace.yaml` globbant déjà `packages/*`, le nouveau package est détecté et les liens `workspace:*` sont résolus. Attendu : « Done in … ».

- [ ] **Step 3 : Écrire le test du pool (il échoue)**

Créer `packages/gizmos/test/gizmo-pool.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { SceneGraph } from "@atlasjs/nebula";
import type { NebulaRenderer, RectNode, CircleNode } from "@atlasjs/nebula";
import { GIZMO_SORTING_LAYER } from "../src/NodeRing";
import { GizmoNodePool } from "../src/GizmoNodePool";
import { GizmoSettings } from "../src/GizmoSettings";
import { Gizmos } from "../src/Gizmos";

function setup(): { scene: SceneGraph; pool: GizmoNodePool; gizmos: Gizmos } {
  const scene: SceneGraph = new SceneGraph();
  const nebula: NebulaRenderer = { scene } as unknown as NebulaRenderer;
  const pool: GizmoNodePool = new GizmoNodePool(nebula);
  const gizmos: Gizmos = new Gizmos(pool, new GizmoSettings());

  return { scene, pool, gizmos };
}

describe("GizmoNodePool", () => {
  it("crée un nœud par forme et l'ajoute à la scène", () => {
    const { scene, gizmos } = setup();

    gizmos.drawRect(10, 20, 40, 60, 0);
    gizmos.drawCircle(5, 5, 8);

    expect(scene.root.getChildren().length).toBe(2);
  });

  it("pose GIZMO_SORTING_LAYER sur les nœuds acquis", () => {
    const { scene, gizmos } = setup();

    gizmos.drawRect(0, 0, 10, 10, 0);

    expect(scene.root.getChildren()[0].sortingLayer).toBe(GIZMO_SORTING_LAYER);
    expect(GIZMO_SORTING_LAYER).toBe(1_000_000);
  });

  it("réutilise les mêmes instances à la frame suivante", () => {
    const { scene, pool, gizmos } = setup();

    gizmos.drawRect(0, 0, 10, 10, 0);
    gizmos.drawRect(0, 0, 10, 10, 0);
    const first: RectNode = scene.root.getChildren()[0] as RectNode;
    const second: RectNode = scene.root.getChildren()[1] as RectNode;

    pool.hideUnused();
    pool.reset();

    gizmos.drawRect(1, 1, 20, 20, 0);
    gizmos.drawRect(1, 1, 20, 20, 0);

    expect(scene.root.getChildren().length).toBe(2);
    expect(scene.root.getChildren()[0]).toBe(first);
    expect(scene.root.getChildren()[1]).toBe(second);
  });

  it("masque les nœuds non réutilisés et remontre ceux qui le sont", () => {
    const { scene, pool, gizmos } = setup();

    gizmos.drawRect(0, 0, 10, 10, 0);
    gizmos.drawRect(0, 0, 10, 10, 0);
    gizmos.drawRect(0, 0, 10, 10, 0);
    pool.hideUnused();
    pool.reset();

    gizmos.drawRect(0, 0, 10, 10, 0);
    pool.hideUnused();

    const children = scene.root.getChildren();
    expect(children[0].visible).toBe(true);
    expect(children[1].visible).toBe(false);
    expect(children[2].visible).toBe(false);

    pool.reset();
    gizmos.drawRect(0, 0, 10, 10, 0);
    gizmos.drawRect(0, 0, 10, 10, 0);
    expect(children[1].visible).toBe(true);
  });

  it("applique la couleur courante, la géométrie et le borderWidth", () => {
    const { scene, gizmos } = setup();

    gizmos.color.set(0, 1, 0, 1);
    gizmos.borderWidth = 3;
    gizmos.drawRect(10, 20, 40, 60, 0.5);

    const rect: RectNode = scene.root.getChildren()[0] as RectNode;
    expect(rect.color.g).toBe(1);
    expect(rect.color.r).toBe(0);
    expect(rect.borderWidth).toBe(3);
    expect(rect.width).toBe(40);
    expect(rect.height).toBe(60);
    expect(rect.transform.position.x).toBe(10);
    expect(rect.transform.position.y).toBe(20);
    expect(rect.transform.rotation).toBe(0.5);
  });

  it("dessine un disque quand borderWidth vaut 0", () => {
    const { scene, gizmos } = setup();

    gizmos.borderWidth = 0;
    gizmos.drawCircle(0, 0, 7);

    const circle: CircleNode = scene.root.getChildren()[0] as CircleNode;
    expect(circle.borderWidth).toBe(0);
    expect(circle.radius).toBe(7);
  });

  it("dispose retire les nœuds de la scène", () => {
    const { scene, pool, gizmos } = setup();

    gizmos.drawRect(0, 0, 10, 10, 0);
    gizmos.drawCircle(0, 0, 5);
    pool.dispose();

    expect(scene.root.getChildren().length).toBe(0);
  });
});
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il échoue**

```bash
pnpm --filter @atlasjs/gizmos test
```

Attendu : ÉCHEC — `Cannot find module '../src/GizmoNodePool'`.

- [ ] **Step 5 : Implémenter `GizmoSettings`**

`packages/gizmos/src/GizmoSettings.ts` :

```ts
import { Color } from "@atlasjs/nebula";

export class GizmoSettings {
  public showColliders: boolean;
  public showPivots: boolean;
  public colliderColor: Color;
  public sensorColor: Color;
  public pivotColor: Color;
  public pivotRadius: number;
  public borderWidth: number;

  public constructor(options: GizmoPluginOptions = {}) {
    this.showColliders = options.showColliders ?? false;
    this.showPivots = options.showPivots ?? false;
    this.colliderColor = options.colliderColor ?? new Color(0, 1, 0, 1);
    this.sensorColor = options.sensorColor ?? new Color(0, 1, 1, 1);
    this.pivotColor = options.pivotColor ?? new Color(1, 0, 1, 1);
    this.pivotRadius = options.pivotRadius ?? 2;
    this.borderWidth = options.borderWidth ?? 1;
  }
}

export type GizmoPluginOptions = Partial<{
  showColliders: boolean;
  showPivots: boolean;
  colliderColor: Color;
  sensorColor: Color;
  pivotColor: Color;
  pivotRadius: number;
  borderWidth: number;
}>;
```

- [ ] **Step 6 : Implémenter `NodeRing`, puis `GizmoNodePool`**

Un anneau générique, composé une fois par type de nœud. Deux méthodes `acquire` verbatim seraient une duplication de bloc logique, et l'anneau de `LineNode` de la V2 deviendra une ligne au lieu d'un copier-coller.

`packages/gizmos/src/NodeRing.ts` :

```ts
import type { NebulaRenderer, ShapeNode } from "@atlasjs/nebula";

export const GIZMO_SORTING_LAYER: number = 1_000_000;

export class NodeRing<T extends ShapeNode> {
  private readonly nebula: NebulaRenderer;
  private readonly create: () => T;
  private readonly nodes: T[];
  private cursor: number;

  public constructor(nebula: NebulaRenderer, create: () => T) {
    this.nebula = nebula;
    this.create = create;
    this.nodes = [];
    this.cursor = 0;
  }

  public acquire(): T {
    if (this.cursor === this.nodes.length) {
      const created: T = this.create();
      created.sortingLayer = GIZMO_SORTING_LAYER;
      this.nebula.scene.addChild(created);
      this.nodes.push(created);
    }

    const node: T = this.nodes[this.cursor];
    this.cursor += 1;
    node.setVisible(true);

    return node;
  }

  public hideUnused(): void {
    for (let i: number = this.cursor; i < this.nodes.length; i += 1) {
      this.nodes[i].setVisible(false);
    }
  }

  public reset(): void {
    this.cursor = 0;
  }

  public dispose(): void {
    for (const node of this.nodes) {
      node.removeFromParent();
    }

    this.nodes.length = 0;
    this.cursor = 0;
  }
}
```

`packages/gizmos/src/GizmoNodePool.ts` :

```ts
import { CircleNode, RectNode } from "@atlasjs/nebula";
import type { NebulaRenderer } from "@atlasjs/nebula";

import { NodeRing } from "./NodeRing";

export class GizmoNodePool {
  private readonly rects: NodeRing<RectNode>;
  private readonly circles: NodeRing<CircleNode>;

  public constructor(nebula: NebulaRenderer) {
    this.rects = new NodeRing<RectNode>(nebula, () => new RectNode());
    this.circles = new NodeRing<CircleNode>(nebula, () => new CircleNode());
  }

  public acquireRect(): RectNode {
    return this.rects.acquire();
  }

  public acquireCircle(): CircleNode {
    return this.circles.acquire();
  }

  public hideUnused(): void {
    this.rects.hideUnused();
    this.circles.hideUnused();
  }

  public reset(): void {
    this.rects.reset();
    this.circles.reset();
  }

  public dispose(): void {
    this.rects.dispose();
    this.circles.dispose();
  }
}
```

`GIZMO_SORTING_LAYER` vit dans `NodeRing.ts` et non dans `GizmoNodePool.ts` : l'anneau est le seul consommateur (il le pose sur chaque nœud qu'il crée), et l'inverse créerait un import circulaire entre les deux fichiers.

- [ ] **Step 7 : Implémenter `Gizmos`**

`packages/gizmos/src/Gizmos.ts` :

```ts
import { Color } from "@atlasjs/nebula";
import type { CircleNode, RectNode } from "@atlasjs/nebula";

import { GizmoNodePool } from "./GizmoNodePool";
import { GizmoSettings } from "./GizmoSettings";

export class Gizmos {
  public readonly settings: GizmoSettings;
  public readonly color: Color;
  public borderWidth: number;

  private readonly pool: GizmoNodePool;

  public constructor(pool: GizmoNodePool, settings: GizmoSettings) {
    this.pool = pool;
    this.settings = settings;
    this.color = new Color(1, 1, 1, 1);
    this.borderWidth = settings.borderWidth;
  }

  public drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number,
  ): void {
    const node: RectNode = this.pool.acquireRect();

    node
      .setColor(this.color.r, this.color.g, this.color.b, this.color.a)
      .setBorderWidth(this.borderWidth);

    node.setPosition(x, y).setRotation(rotation);
    node.setSize(width, height);
  }

  public drawCircle(x: number, y: number, radius: number): void {
    const node: CircleNode = this.pool.acquireCircle();

    node
      .setColor(this.color.r, this.color.g, this.color.b, this.color.a)
      .setBorderWidth(this.borderWidth);

    node.setPosition(x, y).setRotation(0);
    node.setRadius(radius);
  }
}
```

**Ordre des appels important :** `setSize`/`setRadius` écrivent `transform.scale`, `setPosition` écrit la translation. Appeler `setSize` **après** `setPosition` est sans effet de bord, mais ne pas remplacer `setSize(w, h)` par `setScale(w, h)` — c'est la même chose aujourd'hui, mais `setSize` est le contrat public de `RectNode`.

- [ ] **Step 8 : Lancer le test du pool pour vérifier qu'il passe**

```bash
pnpm --filter @atlasjs/gizmos test -- gizmo-pool
```

Attendu : PASS, 7 tests.

- [ ] **Step 9 : Créer les composants et le token**

`packages/gizmos/src/components/ColliderGizmo.ts` :

```ts
import type { Color } from "@atlasjs/nebula";

export class ColliderGizmo {
  public color: Color | null;

  public constructor(color: Color | null = null) {
    this.color = color;
  }
}
```

`packages/gizmos/src/components/PivotGizmo.ts` :

```ts
import type { Color } from "@atlasjs/nebula";

export class PivotGizmo {
  public color: Color | null;
  public radius: number | null;

  public constructor(color: Color | null = null, radius: number | null = null) {
    this.color = color;
    this.radius = radius;
  }
}
```

`packages/gizmos/src/tokens.ts` :

```ts
import { ServiceRegistry, ServiceToken } from "@atlasjs/core";

import { Gizmos } from "./Gizmos";

export const GIZMOS: ServiceToken<Gizmos> =
  ServiceRegistry.createToken<Gizmos>("GIZMOS");
```

`null` signifie « hérite du `settings` » pour les trois overrides. Un seul modèle mental, pas de question « qui gagne ».

- [ ] **Step 10 : Écrire le test du plugin (il échoue)**

Les systèmes n'existent pas encore (Tasks 3 et 4) : ce test vérifie le **câblage**, pas la production de gizmos. Créer `packages/gizmos/test/gizmo-plugin.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { Engine, Plugin } from "@atlasjs/core";
import type { ServiceToken } from "@atlasjs/core";
import { NEXUS, NexusPlugin } from "@atlasjs/nexus";
import type { NexusWorld } from "@atlasjs/nexus";
import { NEBULA_RENDERER, SceneGraph } from "@atlasjs/nebula";

import { GIZMOS } from "../src/tokens";
import { Gizmos } from "../src/Gizmos";
import { GizmoPlugin } from "../src/GizmoPlugin";
import { ColliderGizmo } from "../src/components/ColliderGizmo";
import { PivotGizmo } from "../src/components/PivotGizmo";

const FIXED: number = 0.1;

class Provide extends Plugin {
  public constructor(
    id: string,
    private readonly token: ServiceToken<unknown>,
    private readonly value: unknown,
  ) {
    super(id, { provides: [token] });
  }

  public install(engine: Engine): void {
    engine.services.provide(this.token, this.value);
    this.deferred.resolve();
  }

  public uninstall(): void {}
}

async function boot(showColliders: boolean = false): Promise<{
  engine: Engine;
  world: NexusWorld;
  scene: SceneGraph;
  gizmos: Gizmos;
  frame: () => void;
}> {
  let onTick: ((dt: number) => void) | null = null;
  const scene: SceneGraph = new SceneGraph();

  const engine: Engine = new Engine({
    fixedDelta: FIXED,
    maxSubSteps: 64,
    loop: (cb) => {
      onTick = cb;
      return () => {};
    },
  });

  engine.use(new NexusPlugin());
  engine.use(
    new Provide("stub-nebula", NEBULA_RENDERER, {
      createSampler: () => ({}),
      scene,
    }),
  );
  engine.use(new GizmoPlugin({ showColliders }));

  await engine.start();

  return {
    engine,
    world: engine.services.get<NexusWorld>(NEXUS),
    scene,
    gizmos: engine.services.get<Gizmos>(GIZMOS),
    frame: (): void => onTick!(FIXED * 1.5),
  };
}

describe("GizmoPlugin", () => {
  it("fournit le service GIZMOS", async () => {
    const { gizmos } = await boot();
    expect(gizmos).toBeInstanceOf(Gizmos);
  });

  it("propage les options d'install dans le settings", async () => {
    const { gizmos } = await boot(true);
    expect(gizmos.settings.showColliders).toBe(true);
    expect(gizmos.settings.showPivots).toBe(false);
    expect(gizmos.settings.pivotRadius).toBe(2);
    expect(gizmos.settings.borderWidth).toBe(1);
  });

  it("définit les deux composants sur le monde", async () => {
    const { world } = await boot();
    const entity = world.createEntity();

    expect(() => world.addComponent(entity, ColliderGizmo)).not.toThrow();
    expect(() => world.addComponent(entity, PivotGizmo)).not.toThrow();
  });

  it("flush masque les nœuds non réutilisés à chaque frame", async () => {
    const { scene, gizmos, frame } = await boot();

    gizmos.drawRect(0, 0, 10, 10, 0);
    gizmos.drawRect(0, 0, 10, 10, 0);
    frame();

    expect(scene.root.getChildren().length).toBe(2);
    expect(scene.root.getChildren()[0].visible).toBe(false);
    expect(scene.root.getChildren()[1].visible).toBe(false);
  });

  it("uninstall retire les nœuds du pool de la scène", async () => {
    const { engine, gizmos, scene } = await boot();

    gizmos.drawRect(0, 0, 10, 10, 0);
    gizmos.drawCircle(0, 0, 5);
    expect(scene.root.getChildren().length).toBe(2);

    engine.stop();

    expect(scene.root.getChildren().length).toBe(0);
  });
});
```

Note sur le 4ᵉ cas : les dessins sont faits **hors** step, donc quand `gizmos:flush` tourne dans la frame il ne voit aucun producteur — les deux nœuds sont au-delà du curseur et sont donc masqués. C'est exactement le comportement attendu, et c'est ce qui prouve que le flush tourne.

- [ ] **Step 11 : Lancer le test pour vérifier qu'il échoue**

```bash
pnpm --filter @atlasjs/gizmos test -- gizmo-plugin
```

Attendu : ÉCHEC — `Cannot find module '../src/GizmoPlugin'`.

- [ ] **Step 12 : Implémenter `GizmoPlugin`**

Cette étape n'enregistre **que** le step `gizmos:flush` : les deux systèmes producteurs arrivent en Tasks 3 et 4.

**Le flush ne nomme aucun producteur.** `Scheduler.assertSameStage` **throw** si un `before`/`after` désigne un step absent du même stage (`packages/core/src/public/engine/Scheduler.ts`) — un `after: ["gizmos:collider", …]` ici ferait planter la première frame tant que ces steps n'existent pas. La dépendance est donc **inversée** : chaque producteur déclare `before: "gizmos:flush"`. C'est aussi le bon sens de couplage — le flush n'a pas à connaître la liste de ses producteurs, et c'est exactement le seam d'extension décrit au § 5.1 du spec.

`packages/gizmos/src/GizmoPlugin.ts` :

```ts
import { Engine, Plugin, StepHandle } from "@atlasjs/core";
import { createLogger, Logger } from "@atlasjs/utils";
import { NEXUS, NexusWorld } from "@atlasjs/nexus";
import { NEBULA_RENDERER, NebulaRenderer } from "@atlasjs/nebula";

import { GIZMOS } from "./tokens";
import { Gizmos } from "./Gizmos";
import { GizmoNodePool } from "./GizmoNodePool";
import { GizmoPluginOptions, GizmoSettings } from "./GizmoSettings";
import { ColliderGizmo } from "./components/ColliderGizmo";
import { PivotGizmo } from "./components/PivotGizmo";

export class GizmoPlugin extends Plugin {
  private readonly logger: Logger;
  private readonly options: GizmoPluginOptions;
  private handles: StepHandle[];
  private pool: GizmoNodePool | null;

  public constructor(options: GizmoPluginOptions = {}) {
    super("gizmo-plugin", {
      requires: [NEXUS, NEBULA_RENDERER],
      provides: [GIZMOS],
    });

    this.logger = createLogger(GizmoPlugin.name);
    this.options = options;
    this.handles = [];
    this.pool = null;
  }

  public async install(engine: Engine): Promise<void> {
    const world: NexusWorld = await engine.services.wait(NEXUS);
    const nebula: NebulaRenderer = await engine.services.wait(NEBULA_RENDERER);

    const settings: GizmoSettings = new GizmoSettings(this.options);
    const pool: GizmoNodePool = new GizmoNodePool(nebula);
    const gizmos: Gizmos = new Gizmos(pool, settings);

    this.pool = pool;

    world.defineComponent(ColliderGizmo).defineComponent(PivotGizmo);

    this.handles.push(
      engine.scheduler.render.add(
        () => {
          pool.hideUnused();
          pool.reset();
        },
        {
          name: "gizmos:flush",
          stage: "PreRender",
        },
      ),
    );

    engine.services.provide(GIZMOS, gizmos);
    this.logger.log("GizmoPlugin installed.");
    this.deferred.resolve();
  }

  public uninstall(): void {
    for (const handle of this.handles) {
      handle.remove();
    }

    this.handles = [];
    this.pool?.dispose();
    this.pool = null;
  }
}
```

- [ ] **Step 13 : Écrire `index.ts`**

`packages/gizmos/src/index.ts` :

```ts
export * from "./tokens";
export * from "./Gizmos";
export * from "./GizmoSettings";
export * from "./NodeRing";
export * from "./GizmoNodePool";
export * from "./GizmoPlugin";
export * from "./components/ColliderGizmo";
export * from "./components/PivotGizmo";
```

- [ ] **Step 14 : Lancer toute la suite et le typecheck**

```bash
pnpm --filter @atlasjs/gizmos test
```

Attendu : PASS, 12 tests (7 pool + 5 plugin).

```bash
pnpm --filter @atlasjs/gizmos typecheck
```

Attendu : aucune sortie (succès). Si des types de `@atlasjs/nebula` ou `@atlasjs/gameplay` sont introuvables, construire les dépendances d'abord : `pnpm --filter @atlasjs/gizmos... build`.

- [ ] **Step 15 : Formater et stager (NE PAS COMMITER)**

```bash
npx prettier --write "packages/gizmos/src/**/*.ts" "packages/gizmos/test/**/*.ts" packages/gizmos/tsdown.config.ts packages/gizmos/vitest.config.ts
git add packages/gizmos pnpm-lock.yaml
git status --short
```

Message de commit suggéré, à laisser à l'utilisateur : `feat(gizmos): package skeleton with immediate-mode service, node pool and plugin`

---

## Task 3 : `ColliderGizmoSystem`

Le cœur de la feature. Les tests de cette tâche **sont** la spécification : ils encodent la règle « le gizmo ne mentit jamais ».

**Files:**
- Create: `packages/gizmos/src/systems/ColliderGizmoSystem.ts`
- Modify: `packages/gizmos/src/index.ts`, `packages/gizmos/src/GizmoPlugin.ts`
- Test: `packages/gizmos/test/collider-gizmo-system.test.ts`

**Interfaces:**
- Consumes (Task 2) : `Gizmos`, `GizmoSettings`, `ColliderGizmo`, `GizmoNodePool`.
- Produces : `class ColliderGizmoSystem implements NexusSystem` — `constructor(gizmos: Gizmos)`, `update(ctx: NexusSystemContext): void`. Enregistré sous le nom de step `"gizmos:collider"`.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `packages/gizmos/test/collider-gizmo-system.test.ts` :

```ts
import { describe, expect, it, vi } from "vitest";
import { Transform2D as MathTransform2D, Vec2 } from "@atlasjs/math";
import { Color, SceneGraph } from "@atlasjs/nebula";
import type { CircleNode, NebulaRenderer, Node, RectNode } from "@atlasjs/nebula";
import { NexusWorld } from "@atlasjs/nexus";
import type { Entity } from "@atlasjs/nexus";
import type { Collider, ColliderShapeDesc } from "@atlasjs/inertia";
import { Collider2D, PhysicsColliderRef, WorldTransform2D } from "@atlasjs/gameplay";

import { GizmoNodePool } from "../src/GizmoNodePool";
import { GizmoSettings } from "../src/GizmoSettings";
import { Gizmos } from "../src/Gizmos";
import { ColliderGizmo } from "../src/components/ColliderGizmo";
import { ColliderGizmoSystem } from "../src/systems/ColliderGizmoSystem";

interface Ctx {
  world: NexusWorld;
  scene: SceneGraph;
  gizmos: Gizmos;
  system: ColliderGizmoSystem;
}

function setup(): Ctx {
  const world: NexusWorld = new NexusWorld();
  world
    .defineComponent(WorldTransform2D)
    .defineComponent(Collider2D)
    .defineComponent(PhysicsColliderRef)
    .defineComponent(ColliderGizmo);

  const scene: SceneGraph = new SceneGraph();
  const nebula: NebulaRenderer = { scene } as unknown as NebulaRenderer;
  const gizmos: Gizmos = new Gizmos(
    new GizmoNodePool(nebula),
    new GizmoSettings(),
  );

  return { world, scene, gizmos, system: new ColliderGizmoSystem(gizmos) };
}

function fakeCollider(x: number, y: number, rotation: number = 0): Collider {
  return {
    getTranslation: (): Vec2 => new Vec2(x, y),
    getRotation: (): number => rotation,
  } as unknown as Collider;
}

/** Entité avec un WorldTransform2D à `scale`, un Collider2D et son ref physique. */
function spawn(
  ctx: Ctx,
  shape: ColliderShapeDesc,
  colliderWorld: { x: number; y: number; rotation?: number },
  scale: number = 1,
): Entity {
  const entity: Entity = ctx.world.createEntity();

  const transform: MathTransform2D = new MathTransform2D();
  transform.scale.set(scale, scale);
  ctx.world
    .addComponent(entity, WorldTransform2D)
    .matrix.fromTransform2D(transform);

  ctx.world.addComponent(entity, Collider2D, shape);
  ctx.world.addComponent(
    entity,
    PhysicsColliderRef,
    fakeCollider(colliderWorld.x, colliderWorld.y, colliderWorld.rotation ?? 0),
  );

  return entity;
}

function visible(scene: SceneGraph): ReadonlyArray<Node> {
  return scene.root.getChildren().filter((node: Node) => node.visible);
}

describe("ColliderGizmoSystem", () => {
  it("dessine la vérité physique, pas l'intention : extents non scalés à la position rapier", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showColliders = true;

    spawn(ctx, { type: "box", width: 40, height: 40 }, { x: 300, y: 120 }, 2);

    ctx.system.update({ world: ctx.world, dt: 0 });

    const rect: RectNode = ctx.scene.root.getChildren()[0] as RectNode;
    expect(rect.width).toBe(40);
    expect(rect.height).toBe(40);
    expect(rect.transform.position.x).toBe(300);
    expect(rect.transform.position.y).toBe(120);
  });

  it("reporte la rotation du collider rapier", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showColliders = true;

    spawn(ctx, { type: "box", width: 10, height: 10 }, { x: 0, y: 0, rotation: 0.75 });

    ctx.system.update({ world: ctx.world, dt: 0 });

    const rect: RectNode = ctx.scene.root.getChildren()[0] as RectNode;
    expect(rect.transform.rotation).toBe(0.75);
  });

  it("ne dessine rien pour un Collider2D sans PhysicsColliderRef", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showColliders = true;

    const entity: Entity = ctx.world.createEntity();
    const transform: MathTransform2D = new MathTransform2D();
    ctx.world
      .addComponent(entity, WorldTransform2D)
      .matrix.fromTransform2D(transform);
    ctx.world.addComponent(entity, Collider2D, {
      type: "box",
      width: 40,
      height: 40,
    });

    ctx.system.update({ world: ctx.world, dt: 0 });

    expect(ctx.scene.root.getChildren().length).toBe(0);
  });

  it("dessine un cercle pour un collider circle", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showColliders = true;

    spawn(ctx, { type: "circle", radius: 12 }, { x: 5, y: 6 });

    ctx.system.update({ world: ctx.world, dt: 0 });

    const circle: CircleNode = ctx.scene.root.getChildren()[0] as CircleNode;
    expect(circle.radius).toBe(12);
    expect(circle.borderWidth).toBe(1);
  });

  it("utilise sensorColor pour un sensor", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showColliders = true;

    const entity: Entity = spawn(
      ctx,
      { type: "box", width: 10, height: 10 },
      { x: 0, y: 0 },
    );
    ctx.world.requireComponent(entity, Collider2D).isSensor = true;

    ctx.system.update({ world: ctx.world, dt: 0 });

    const rect: RectNode = ctx.scene.root.getChildren()[0] as RectNode;
    expect([rect.color.r, rect.color.g, rect.color.b]).toEqual([0, 1, 1]);
  });

  it("dessine sans composant quand showColliders est vrai", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showColliders = true;

    spawn(ctx, { type: "box", width: 10, height: 10 }, { x: 0, y: 0 });

    ctx.system.update({ world: ctx.world, dt: 0 });

    expect(visible(ctx.scene).length).toBe(1);
  });

  it("ne dessine rien sans composant quand showColliders est faux", () => {
    const ctx: Ctx = setup();

    spawn(ctx, { type: "box", width: 10, height: 10 }, { x: 0, y: 0 });

    ctx.system.update({ world: ctx.world, dt: 0 });

    expect(ctx.scene.root.getChildren().length).toBe(0);
  });

  it("dessine avec le composant seul quand showColliders est faux", () => {
    const ctx: Ctx = setup();

    const entity: Entity = spawn(
      ctx,
      { type: "box", width: 10, height: 10 },
      { x: 0, y: 0 },
    );
    ctx.world.addComponent(entity, ColliderGizmo);

    ctx.system.update({ world: ctx.world, dt: 0 });

    expect(visible(ctx.scene).length).toBe(1);
  });

  it("ne dessine qu'une fois quand le composant et le switch global sont actifs", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showColliders = true;

    const entity: Entity = spawn(
      ctx,
      { type: "box", width: 10, height: 10 },
      { x: 0, y: 0 },
    );
    ctx.world.addComponent(entity, ColliderGizmo);

    ctx.system.update({ world: ctx.world, dt: 0 });

    expect(visible(ctx.scene).length).toBe(1);
  });

  it("laisse le composant surcharger la couleur", () => {
    const ctx: Ctx = setup();

    const entity: Entity = spawn(
      ctx,
      { type: "box", width: 10, height: 10 },
      { x: 0, y: 0 },
    );
    ctx.world.addComponent(entity, ColliderGizmo, new Color(1, 0, 0, 1));

    ctx.system.update({ world: ctx.world, dt: 0 });

    const rect: RectNode = ctx.scene.root.getChildren()[0] as RectNode;
    expect([rect.color.r, rect.color.g, rect.color.b]).toEqual([1, 0, 0]);
  });

  it("ne dessine rien pour une capsule et ne warn qu'une fois sur 3 frames", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showColliders = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    spawn(ctx, { type: "capsule", radius: 5, halfHeight: 10 }, { x: 0, y: 0 });

    ctx.system.update({ world: ctx.world, dt: 0 });
    ctx.system.update({ world: ctx.world, dt: 0 });
    ctx.system.update({ world: ctx.world, dt: 0 });

    expect(ctx.scene.root.getChildren().length).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });
});
```

**Si le dernier cas ne voit pas le `console.warn` :** `createLogger` de `@atlasjs/utils` est piloté par les `define` du `vitest.config.ts` (`__CONSOLE_TRANSPORT__: "false"`). Dans ce cas, ne pas espionner `console` — injecter un logger de test, ou passer `__CONSOLE_TRANSPORT__` à `"true"` dans le `vitest.config.ts` du package. **Vérifier le comportement réel avant de choisir**, et garder l'assertion « une seule fois sur 3 frames » : c'est elle qui compte.

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
pnpm --filter @atlasjs/gizmos test -- collider-gizmo-system
```

Attendu : ÉCHEC — `Cannot find module '../src/systems/ColliderGizmoSystem'`.

- [ ] **Step 3 : Implémenter le système**

`packages/gizmos/src/systems/ColliderGizmoSystem.ts` :

```ts
import { createLogger, Logger } from "@atlasjs/utils";
import { Color } from "@atlasjs/nebula";
import type { Vec2 } from "@atlasjs/math";
import type { Collider, ColliderShapeDesc } from "@atlasjs/inertia";
import { Collider2D, PhysicsColliderRef } from "@atlasjs/gameplay";
import type { Entity, NexusSystem, NexusSystemContext } from "@atlasjs/nexus";

import { Gizmos } from "../Gizmos";
import { GizmoSettings } from "../GizmoSettings";
import { ColliderGizmo } from "../components/ColliderGizmo";

export class ColliderGizmoSystem implements NexusSystem {
  private readonly gizmos: Gizmos;
  private readonly logger: Logger;
  private readonly warned: Set<string>;

  public constructor(gizmos: Gizmos) {
    this.gizmos = gizmos;
    this.logger = createLogger(ColliderGizmoSystem.name);
    this.warned = new Set<string>();
  }

  // prettier-ignore
  public update({ world }: NexusSystemContext): void {
    const settings: GizmoSettings = this.gizmos.settings;

    world.query(Collider2D, PhysicsColliderRef).optional(ColliderGizmo).each((
      _entity: Entity,
      collider: Collider2D,
      ref: PhysicsColliderRef,
      gizmo: ColliderGizmo | undefined,
    ) => {
      if (!settings.showColliders && gizmo === undefined) {
        return;
      }

      const shape: ColliderShapeDesc = collider.shape;

      if (shape.type !== "box" && shape.type !== "circle") {
        this.warnOnce(shape.type);
        return;
      }

      const fallback: Color = collider.isSensor
        ? settings.sensorColor
        : settings.colliderColor;

      const color: Color = gizmo?.color ?? fallback;

      this.gizmos.color.set(color.r, color.g, color.b, color.a);
      this.gizmos.borderWidth = settings.borderWidth;

      const physics: Collider = ref.collider;
      const translation: Vec2 = physics.getTranslation();

      if (shape.type === "box") {
        this.gizmos.drawRect(
          translation.x,
          translation.y,
          shape.width,
          shape.height,
          physics.getRotation(),
        );

        return;
      }

      this.gizmos.drawCircle(translation.x, translation.y, shape.radius);
    });
  }

  private warnOnce(type: string): void {
    if (this.warned.has(type)) {
      return;
    }

    this.warned.add(type);
    this.logger.warn(
      `Collider gizmo does not support shape '${type}'; nothing drawn.`,
    );
  }
}
```

Trois choses à ne pas « optimiser » :

- **`shape.width`/`shape.height` ne sont jamais multipliés par une échelle.** La physique ne le fait pas ; le gizmo ne doit pas le faire.
- **Le narrowing par `shape.type`** avant l'accès à `.width`/`.radius` est ce qui rend `ColliderShapeDesc` sûr. Ne pas le remplacer par un cast.
- **`warnOnce`** est keyé par type de forme, pas par entité : un warn par frame noie la console à 60 fps.

- [ ] **Step 4 : Enregistrer le système dans le plugin**

Dans `packages/gizmos/src/GizmoPlugin.ts` — ajouter l'import de `registerSystem` et du système, instancier, et enregistrer **avant** le step de flush existant :

```ts
import { registerSystem } from "@atlasjs/gameplay";
import { ColliderGizmoSystem } from "./systems/ColliderGizmoSystem";
```

Puis, dans `install`, juste avant le `this.handles.push(...)` du flush :

```ts
    const colliderSystem: ColliderGizmoSystem = new ColliderGizmoSystem(gizmos);

    this.handles.push(
      registerSystem(engine.scheduler.render, world, colliderSystem, {
        name: "gizmos:collider",
        stage: "PreRender",
        before: "gizmos:flush",
      }),
    );
```

Le `before: "gizmos:flush"` est obligatoire : sans lui, l'ordre relatif des deux steps dépend de l'ordre d'insertion, et un flush qui tourne avant le producteur masquerait les gizmos de la frame. Ne pas ajouter d'`after` sur le flush en retour (cf. Task 2 Step 12).

- [ ] **Step 5 : Exporter le système**

Ajouter à `packages/gizmos/src/index.ts` :

```ts
export * from "./systems/ColliderGizmoSystem";
```

- [ ] **Step 6 : Lancer les tests pour vérifier qu'ils passent**

```bash
pnpm --filter @atlasjs/gizmos test
```

Attendu : PASS, 23 tests (7 pool + 5 plugin + 11 collider).

```bash
pnpm --filter @atlasjs/gizmos typecheck
```

Attendu : aucune sortie.

- [ ] **Step 7 : Formater et stager (NE PAS COMMITER)**

```bash
npx prettier --write "packages/gizmos/src/**/*.ts" "packages/gizmos/test/**/*.ts"
git add packages/gizmos
git status --short
```

Message de commit suggéré, à laisser à l'utilisateur : `feat(gizmos): collider gizmo system reading physics truth`

---

## Task 4 : `PivotGizmoSystem`

**Files:**
- Create: `packages/gizmos/src/systems/PivotGizmoSystem.ts`
- Modify: `packages/gizmos/src/index.ts`, `packages/gizmos/src/GizmoPlugin.ts`
- Test: `packages/gizmos/test/pivot-gizmo-system.test.ts`

**Interfaces:**
- Consumes (Tasks 2, 3) : `Gizmos`, `GizmoSettings`, `PivotGizmo`, `registerSystem`.
- Produces : `class PivotGizmoSystem implements NexusSystem` — `constructor(gizmos: Gizmos)`. Step `"gizmos:pivot"`.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `packages/gizmos/test/pivot-gizmo-system.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { Transform2D as MathTransform2D } from "@atlasjs/math";
import { Color, SceneGraph } from "@atlasjs/nebula";
import type { CircleNode, NebulaRenderer } from "@atlasjs/nebula";
import { NexusWorld } from "@atlasjs/nexus";
import type { Entity } from "@atlasjs/nexus";
import { WorldTransform2D } from "@atlasjs/gameplay";

import { GizmoNodePool } from "../src/GizmoNodePool";
import { GizmoSettings } from "../src/GizmoSettings";
import { Gizmos } from "../src/Gizmos";
import { PivotGizmo } from "../src/components/PivotGizmo";
import { PivotGizmoSystem } from "../src/systems/PivotGizmoSystem";

interface Ctx {
  world: NexusWorld;
  scene: SceneGraph;
  gizmos: Gizmos;
  system: PivotGizmoSystem;
}

function setup(): Ctx {
  const world: NexusWorld = new NexusWorld();
  world.defineComponent(WorldTransform2D).defineComponent(PivotGizmo);

  const scene: SceneGraph = new SceneGraph();
  const nebula: NebulaRenderer = { scene } as unknown as NebulaRenderer;
  const gizmos: Gizmos = new Gizmos(
    new GizmoNodePool(nebula),
    new GizmoSettings(),
  );

  return { world, scene, gizmos, system: new PivotGizmoSystem(gizmos) };
}

function spawn(ctx: Ctx, x: number, y: number): Entity {
  const entity: Entity = ctx.world.createEntity();
  const transform: MathTransform2D = new MathTransform2D();
  transform.position.set(x, y);

  ctx.world
    .addComponent(entity, WorldTransform2D)
    .matrix.fromTransform2D(transform);

  return entity;
}

describe("PivotGizmoSystem", () => {
  it("dessine un disque rempli à la position monde de l'entité", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showPivots = true;

    spawn(ctx, 42, -17);

    ctx.system.update({ world: ctx.world, dt: 0 });

    const circle: CircleNode = ctx.scene.root.getChildren()[0] as CircleNode;
    expect(circle.transform.position.x).toBe(42);
    expect(circle.transform.position.y).toBe(-17);
    expect(circle.borderWidth).toBe(0);
    expect(circle.radius).toBe(2);
  });

  it("ne dessine rien sans composant quand showPivots est faux", () => {
    const ctx: Ctx = setup();

    spawn(ctx, 0, 0);

    ctx.system.update({ world: ctx.world, dt: 0 });

    expect(ctx.scene.root.getChildren().length).toBe(0);
  });

  it("dessine avec le composant seul quand showPivots est faux", () => {
    const ctx: Ctx = setup();

    const entity: Entity = spawn(ctx, 1, 2);
    ctx.world.addComponent(entity, PivotGizmo);

    ctx.system.update({ world: ctx.world, dt: 0 });

    expect(ctx.scene.root.getChildren().length).toBe(1);
  });

  it("laisse le composant surcharger couleur et rayon", () => {
    const ctx: Ctx = setup();

    const entity: Entity = spawn(ctx, 0, 0);
    ctx.world.addComponent(entity, PivotGizmo, new Color(1, 1, 0, 1), 9);

    ctx.system.update({ world: ctx.world, dt: 0 });

    const circle: CircleNode = ctx.scene.root.getChildren()[0] as CircleNode;
    expect(circle.radius).toBe(9);
    expect([circle.color.r, circle.color.g, circle.color.b]).toEqual([1, 1, 0]);
  });

  it("retombe sur settings.pivotRadius quand le composant laisse radius à null", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.pivotRadius = 5;

    const entity: Entity = spawn(ctx, 0, 0);
    ctx.world.addComponent(entity, PivotGizmo);

    ctx.system.update({ world: ctx.world, dt: 0 });

    const circle: CircleNode = ctx.scene.root.getChildren()[0] as CircleNode;
    expect(circle.radius).toBe(5);
  });

  it("n'est pas affecté par le borderWidth courant du service", () => {
    const ctx: Ctx = setup();
    ctx.gizmos.settings.showPivots = true;
    ctx.gizmos.borderWidth = 4;

    spawn(ctx, 0, 0);

    ctx.system.update({ world: ctx.world, dt: 0 });

    const circle: CircleNode = ctx.scene.root.getChildren()[0] as CircleNode;
    expect(circle.borderWidth).toBe(0);
  });
});
```

Le dernier cas verrouille un piège réel de l'immediate-mode à état : un producteur qui laisse traîner son style pollue le suivant. Le pivot doit **toujours** forcer `borderWidth = 0`.

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
pnpm --filter @atlasjs/gizmos test -- pivot-gizmo-system
```

Attendu : ÉCHEC — `Cannot find module '../src/systems/PivotGizmoSystem'`.

- [ ] **Step 3 : Implémenter le système**

`packages/gizmos/src/systems/PivotGizmoSystem.ts` :

```ts
import { Vec2 } from "@atlasjs/math";
import { Color } from "@atlasjs/nebula";
import { WorldTransform2D } from "@atlasjs/gameplay";
import type { Entity, NexusSystem, NexusSystemContext } from "@atlasjs/nexus";

import { Gizmos } from "../Gizmos";
import { GizmoSettings } from "../GizmoSettings";
import { PivotGizmo } from "../components/PivotGizmo";

export class PivotGizmoSystem implements NexusSystem {
  private readonly gizmos: Gizmos;
  private readonly positionScratch: Vec2;

  public constructor(gizmos: Gizmos) {
    this.gizmos = gizmos;
    this.positionScratch = new Vec2();
  }

  // prettier-ignore
  public update({ world }: NexusSystemContext): void {
    const settings: GizmoSettings = this.gizmos.settings;

    world.query(WorldTransform2D).optional(PivotGizmo).each((
      _entity: Entity,
      worldTransform: WorldTransform2D,
      gizmo: PivotGizmo | undefined,
    ) => {
      if (!settings.showPivots && gizmo === undefined) {
        return;
      }

      const color: Color = gizmo?.color ?? settings.pivotColor;
      const radius: number = gizmo?.radius ?? settings.pivotRadius;
      const position: Vec2 = worldTransform.getPosition(this.positionScratch);

      this.gizmos.color.set(color.r, color.g, color.b, color.a);
      this.gizmos.borderWidth = 0;
      this.gizmos.drawCircle(position.x, position.y, radius);
    });
  }
}
```

- [ ] **Step 4 : Enregistrer le système dans le plugin**

Dans `packages/gizmos/src/GizmoPlugin.ts`, ajouter l'import puis le step, à côté de celui du collider :

```ts
import { PivotGizmoSystem } from "./systems/PivotGizmoSystem";
```

```ts
    const pivotSystem: PivotGizmoSystem = new PivotGizmoSystem(gizmos);

    this.handles.push(
      registerSystem(engine.scheduler.render, world, pivotSystem, {
        name: "gizmos:pivot",
        stage: "PreRender",
        before: "gizmos:flush",
      }),
    );
```

- [ ] **Step 5 : Exporter le système**

Ajouter à `packages/gizmos/src/index.ts` :

```ts
export * from "./systems/PivotGizmoSystem";
```

- [ ] **Step 6 : Lancer les tests pour vérifier qu'ils passent**

```bash
pnpm --filter @atlasjs/gizmos test
```

Attendu : PASS, 29 tests (7 + 5 + 11 + 6).

```bash
pnpm --filter @atlasjs/gizmos typecheck
```

Attendu : aucune sortie.

- [ ] **Step 7 : Formater et stager (NE PAS COMMITER)**

```bash
npx prettier --write "packages/gizmos/src/**/*.ts" "packages/gizmos/test/**/*.ts"
git add packages/gizmos
git status --short
```

Message de commit suggéré, à laisser à l'utilisateur : `feat(gizmos): pivot gizmo system marking entity origins`

---

## Task 5 : Câblage `dino-brawl`, vérification navigateur, documentation

C'est la tâche qui prouve la feature de bout en bout. Rien de ce qui précède n'a été vu tourner dans un vrai jeu.

**Files:**
- Modify: `apps/dino-brawl/package.json`
- Modify: `apps/dino-brawl/src/app/GameCanvas.tsx`
- Modify: `apps/dino-brawl/src/game/prefabs/weapon/SwordWithShadowPrefab.ts` (retirer le workaround `debug`)
- Modify: `apps/dino-brawl/src/game/loaders/ResourcesIndex.ts` (retirer l'import `debug.png` s'il devient orphelin)
- Modify: `CLAUDE.md`
- Modify: `docs/backlog.md`

**Interfaces:**
- Consumes (Tasks 2–4) : `GizmoPlugin`, `GizmoPluginOptions`, `GIZMOS`, `Gizmos`, `ColliderGizmo`, `PivotGizmo`.
- Produces : rien de nouveau pour les packages.

- [ ] **Step 1 : Ajouter la dépendance**

Dans `apps/dino-brawl/package.json`, ajouter à `dependencies` (ordre alphabétique, entre `@atlasjs/gameplay` et `@atlasjs/inertia`) :

```json
    "@atlasjs/gizmos": "workspace:*",
```

Puis :

```bash
pnpm install
```

- [ ] **Step 2 : Installer le plugin**

Dans `apps/dino-brawl/src/app/GameCanvas.tsx` :

```ts
import { GizmoPlugin } from "@atlasjs/gizmos";
```

Instancier près des autres plugins :

```ts
    const gizmoPlugin: GizmoPlugin = new GizmoPlugin({ showColliders: true });
```

Et l'ajouter à la chaîne `engine.use(...)`, **après** `gameplayPlugin` :

```ts
    engine
      .use(assetPlugin)
      .use(audioPlugin)
      .use(inputPlugin)
      .use(inertiaPlugin)
      .use(rendererPlugin)
      .use(nexusPlugin)
      .use(gameplayPlugin)
      .use(gizmoPlugin);
```

**Piège Vite (déjà rencontré sur ce projet) :** `GizmoPlugin` est utilisé comme **valeur** (`new GizmoPlugin(...)`) → import de valeur normal, surtout **pas** `import type`. À l'inverse, tout symbole utilisé uniquement comme type dans les fichiers de l'app doit être en `import type`, sinon `tsc` passe et le runtime Vite casse en écran noir.

- [ ] **Step 3 : Typecheck de l'app**

```bash
pnpm --filter dino-brawl exec tsc --noEmit -p tsconfig.app.json
```

Attendu : aucune sortie. **`tsc --noEmit` sans `-p tsconfig.app.json` est un no-op dans cette app** (il ne typecheck rien) — toujours passer le projet.

- [ ] **Step 4 : Vérification navigateur — colliders**

Démarrer le serveur de dev de `apps/dino-brawl` via `preview_start` (jamais via Bash), attendre le chargement de la scène, puis capture d'écran.

Attendu :

1. **Contours verts** autour du joueur, des ennemis et des colliders de tuiles du monde.
2. **Contour cyan** sur la hitbox d'épée (elle est `isSensor = true`), visible pendant une attaque.
3. **Les contours sont au-dessus des sprites**, jamais masqués par une tuile ou un occluder — c'est ce que valide `GIZMO_SORTING_LAYER`.
4. **Vérification décisive** : la hitbox d'épée est déclarée `box 40×40` avec `transform.scale = (1.2, 1.2)` sur son entité. Le contour doit mesurer **40×40 en unités monde, pas 48×48**. Comparer sa taille au sprite d'épée : si le contour ne couvre pas ce que le sprite suggère, **c'est le bug de hit detection, pas le gizmo**. C'est le résultat que cette feature existe pour produire.

Si l'écran est noir : `read_console_messages` d'abord. Cause la plus probable dans ce projet, un `import type` manquant ou en trop (cf. Step 2). Redémarrer le serveur de dev plutôt que de faire confiance au HMR.

- [ ] **Step 5 : Vérification navigateur — pivots**

Basculer les pivots à chaud via le service, depuis la console du navigateur ou un `useEffect` temporaire :

```ts
engine.services.get(GIZMOS).settings.showPivots = true;
```

Attendu : un **disque magenta** à l'origine de chaque entité — au pied du joueur si son pivot est `(0.5, 1)`, au coin pour un pivot `(0, 1)` comme celui de l'épée. C'est l'information que `debug.png` donnait, sans le sprite.

Vérifier aussi que basculer à `false` refait disparaître les disques **dans la frame suivante** : c'est le `hideUnused()` du flush qui est testé ici, en conditions réelles.

- [ ] **Step 6 : Retirer le workaround `debug.png`**

Maintenant que les pivots sont natifs, retirer l'échafaudage dans `apps/dino-brawl/src/game/prefabs/weapon/SwordWithShadowPrefab.ts` :

- la propriété `debug?: Sprite;` de `SwordWithShadowPrefabProps` ;
- le bloc `if (props.debug) { … }` qui ajoute un `SpriteRender` sur le layer `Overhead` ;
- l'argument `debug` chez tous les appelants du prefab (les chercher : `grep -rn "debug:" apps/dino-brawl/src`).

Vérifier ensuite si `WhiteSquare` / l'import de `@assets/sprites/debug.png` dans `ResourcesIndex.ts` devient orphelin (`grep -rn "WhiteSquare" apps/dino-brawl/src`) et, si oui, le retirer. **Laisser le fichier `apps/dino-brawl/assets/sprites/debug.png` sur le disque** — ne pas supprimer un asset dans la même passe.

Re-typecheck :

```bash
pnpm --filter dino-brawl exec tsc --noEmit -p tsconfig.app.json
pnpm --filter dino-brawl test
```

Attendu : aucune sortie pour le typecheck ; suite de tests de l'app au vert.

- [ ] **Step 7 : Passer le statut du spec à « implémenté » et mettre à jour l'index des docs**

Dans `docs/debug/gizmos.md`, remplacer la première ligne de citation :

```markdown
> Statut : **design validé, non implémenté**.
```

par :

```markdown
> Statut : **implémenté** (v1). Les extensions V2 sont dans [`../backlog.md`](../backlog.md) § Debug — Gizmos.
```

Puis dans `CLAUDE.md` :

Ajouter une section `### docs/debug/` après `### docs/assets/`, dans le style des entrées existantes :

```markdown
### `docs/debug/`

- `docs/debug/gizmos.md` — **implemented**. Debug gizmos: collider outlines + entity-origin discs as opt-in components (`ColliderGizmo`/`PivotGizmo`) plus a global switch, in a standalone `@atlasjs/gizmos` plugin package. Immediate-mode `Gizmos` service over a recycled node pool flushed by a single `gizmos:flush` step; `GIZMO_SORTING_LAYER` draws over everything without knowing the app's named layers. **Reads physics truth**: position/rotation from `PhysicsColliderRef`, extents from `Collider2D.shape` un-scaled, nothing drawn when no collider exists. Added stroke support to nebula shapes (`ShapeNode.borderWidth` → `params.y` → SDF border), closing the renderer backlog "strokes" item. V2 (editor handles, raycast/vector gizmos, `drawLine`, screen-constant thickness, capsule/segment/polygon) → backlog.
```

- [ ] **Step 8 : Mettre à jour `docs/backlog.md`**

Deux modifications. Dans la section « Shapes — suites naturelles », marquer les strokes comme faits :

```markdown
- ✅ **Strokes / contours** _(fait)_ : `ShapeNode.borderWidth` → `params.y` → SDF de contour en WGSL (rect + cercle), taille monde dérivée de la matrice model. Voir [`debug/gizmos.md`](debug/gizmos.md) § 6. Restent : coins arrondis, polygones arbitraires, remplissage gradient/texture, anchor configurable par forme. `params.z/w` restent réservés aux coins arrondis / feather.
```

Puis ajouter une nouvelle section, à placer après « Gameplay — Prefab » :

```markdown
## Debug — Gizmos

> **Cœur v1 implémenté** : `ColliderGizmo`/`PivotGizmo` + switch global, service immediate-mode `Gizmos` sur pool de nœuds recyclés, stroke SDF dans nebula. Source : [`debug/gizmos.md`](debug/gizmos.md) (§ 9 non-objectifs). Restent les **extensions V2** ci-dessous.

- 📋 **Gizmos d'éditeur** : poignées de sélection/déplacement/échelle, contour de l'entité sélectionnée, preview de collider en cours d'édition. Le seam est déjà posé — tout producteur s'insère avec `before: "gizmos:flush"` sans toucher au package.
- 📋 **`Gizmos.drawLine` + pool de `LineNode`** : débloque d'un coup les gizmos de raycast, les vecteurs (direction, vitesse, normales de contact) et les lignes de hiérarchie parent → enfant. Écarté en v1 faute de consommateur réel.
- 📋 **`capsule` / `segment` / `polygon` exacts** : capsule via un 3ᵉ `shapeKind` SDF, segment/polygon via une boucle de `LineNode`. Aujourd'hui : rien dessiné + un warn unique par type (choix assumé — pas d'AABB approximative, un gizmo ne doit pas mentir sur la géométrie).
- 📋 **Épaisseur de contour constante à l'écran** : `borderWidth` est en unités monde, donc le contour s'épaissit visuellement au zoom. Une épaisseur en pixels demanderait le facteur de zoom caméra dans le shader.
- 📋 **Texte à l'écran** (labels d'entité, valeurs numériques) : dépend du rendu de texte (item A2 de la section Rendering).
- 📋 **Contour du sprite / marqueur de sort point** : rect du sprite rendu, et position du `sortPointEntity`.
- 📋 **Surcharge `Collider.getTranslation(out?: Vec2)`** dans `@atlasjs/inertia` : `RapierCollider.getTranslation()` alloue un `Vec2` par appel, soit ~2 allocations par collider par frame **quand le debug est allumé**. Assumé en v1 (outil opt-in) plutôt que de faire changer un contrat de package physique pour un outil de debug.
- 💭 **Passe/batch gizmo dédiée** dans nebula : overlay dessiné après la scène, hors scene-graph. Conceptuellement plus juste (les gizmos ne sont pas du contenu de scène) mais sans effet sur l'API appelante — le `GIZMO_SORTING_LAYER` produit le même résultat visuel aujourd'hui.
```

**Ne pas reformater `docs/backlog.md`** — édition sémantique seulement, ce fichier n'est pas maintenu par prettier et une passe `--write` ferait exploser le diff sur ses tableaux.

- [ ] **Step 9 : Suite complète**

```bash
pnpm test
```

Attendu : tous les packages au vert, y compris `@atlasjs/gizmos` (29 tests) et `@atlasjs/nebula` (avec les 5 nouveaux).

- [ ] **Step 10 : Formater et stager (NE PAS COMMITER)**

```bash
npx prettier --write apps/dino-brawl/src/app/GameCanvas.tsx apps/dino-brawl/src/game/prefabs/weapon/SwordWithShadowPrefab.ts apps/dino-brawl/src/game/loaders/ResourcesIndex.ts
git add apps/dino-brawl CLAUDE.md docs/backlog.md docs/debug pnpm-lock.yaml
git status --short
```

Message de commit suggéré, à laisser à l'utilisateur : `feat(dino-brawl): enable debug gizmos and drop the debug sprite workaround`

---

## Récapitulatif de vérification

| Affirmation | Preuve |
|---|---|
| Le contour s'affiche et le fill ne régresse pas | Task 1 Step 9 (capture `apps/webgpu`, 4 formes côte à côte) |
| `params.y` transporte le `borderWidth` | Task 1 Step 5 (`ShapeRenderer.test.ts`, 5 cas) |
| Le pool recycle au lieu de churner | Task 2 Step 8 (assertion d'identité des instances entre frames) |
| Le flush masque avant le draw | Task 2 Step 14 + Task 5 Step 5 (toggle à chaud en jeu) |
| **Le gizmo ne mentit pas sur la géométrie** | Task 3 Step 6 (extents non scalés à la position rapier) + Task 5 Step 4 (contrôle 40×40 vs 48×48 en jeu) |
| Le switch global et les composants ne doublent pas | Task 3 Step 6 (cas « composant + global ») |
| Les formes non supportées ne mentent pas et ne spamment pas | Task 3 Step 6 (rien dessiné, un seul warn sur 3 frames) |
| Le pivot est rempli et ignore le style résiduel | Task 4 Step 6 (`borderWidth = 0` forcé) |
| Les gizmos passent au-dessus de tout | Task 5 Step 4 (contours non masqués par tuiles/occluders) |
| Le teardown ne fuit pas de nœuds | Task 2 Step 14 (`uninstall` → scène vide) |
