# Nebula — Refonte Architecture du Renderer

> Statut : **design validé, implémentation à venir**
> Portée : `@atlasjs/nebula` (contrats + couche render agnostique) + `@atlasjs/nebula-webgpu` (impl)
> Objectif : passer d'un renderer « draw immédiat, 1 sprite = 1 draw call » à un renderer scalable et ergonomique, sans casser le split backend-agnostique ni l'autorité de la réflexion WGSL.
> Prérequis de lecture : `docs/shaders-materials-redesign.md` (implémenté). Ce doc en est la suite logique côté pipeline de soumission.

---

## 1. Le problème

L'architecture actuelle a **deux couches saines** mais **il manque celle du milieu** :

- **RHI / device** (`WebGPURenderer` : buffers, textures, pipelines, `draw`) — solide.
- **Scène** (`SceneGraph`, `Node`, `Sprite`, `SceneRenderer`) — correcte mais naïve.

Entre les deux, aucune couche de **soumission** (batching, tri, résolution de pipeline, file de commandes). Conséquence directe : **1 sprite = 1 draw call + rebind de 3 bind groups**, et la scène est intégralement retravaillée chaque frame.

### Défauts constatés

| # | Constat | Fichier |
|---|---------|---------|
| 1 | `draw(geometry, pipeline, material, bindings)` : 4 objets redondants (le pipeline connaît sa géométrie + son shader, le material connaît son shader) → désync possible, d'où le guard `assertGeometryCompatibleWithPipeline` qui n'existe que pour rattraper ça | `WebGPURenderer.ts` |
| 2 | `WebGPUPipelineCache` = **stub vide**, jamais câblé. `createPipeline` fait toujours un `new WebGPUPipeline`. Le user doit créer/porter le `Pipeline` à la main | `caches/WebGPUPipelineCache.ts` |
| 3 | `WebGPURenderState` **write-only** : le binder écrit `pipeline/geometry/bindGroups`, personne ne les lit pour éliminer les rebinds redondants | `states/WebGPURenderState.ts`, `bindings/WebGPUBinder.ts` |
| 4 | 1 sprite = 1 draw call. `objectBindingGroup` = 1 `GPUBuffer` + 1 `writeBuffer` **par sprite** → meurt vers quelques centaines de sprites | `renderers/SpriteRenderer.ts` |
| 5 | `alphaBlend: true` **hardcodé** dans `createPipeline` malgré `PipelineDescriptor.alphaBlend`. Aucun contrôle blend/depth/cull nulle part | `WebGPURenderer.ts` |
| 6 | `getBindGroupLayout(index)` appelé 3× / draw + `device.createBindGroupLayout` inline non-cachés (2 pipelines même shader = layouts dupliqués) | `WebGPURenderer.ts` |
| 7 | Culling allocatoire : `getCameraViewport()` alloue un `Bound` **par sprite**, `getWorldBound()` ~6 `Vec2`+`Bound` **par sprite / frame** | `renderers/SceneRenderer.ts`, `graphics/Sprite.ts` |
| 8 | Scène retravaillée en entier chaque frame : `updateWorldMatrices` sans dirty-flag, `getNodesArraySorted` réalloue + re-sort | `graphics/Node.ts`, `renderers/SceneRenderer.ts` |
| 9 | `Renderer.camera: Camera2D` fige la 2D dans le **contrat** | `core/renderer/Renderer.ts` |
| 10 | `createSpriteShader()` sur le `ResourceFactory` générique → ne scale pas (futurs `createTextShader`, `createShapeShader`…) | `core/renderer/ResourceFactory.ts` |

---

## 2. Décisions de design

| Décision | Choix retenu |
|----------|--------------|
| Objet public de dessin | **`Material` + `Geometry`** ; `Pipeline` devient un artefact **interne caché**, résolu et caché |
| Résolution de pipeline | **`PipelineCache`** keyé par `(shader, vertexLayout, renderState)` — le `createPipelineId()` déjà calculé |
| État de rendu (blend/depth/cull) | Porté par le **`Material`** (`RenderState`), plus jamais hardcodé |
| Soumission | **`DrawCommand` + clé de tri packée + `RenderQueue`** dans `nebula` (agnostique) |
| Batching | **Storage buffer + instancing** : quad généré en VS, tableau d'instances en `var<storage, read>`, `draw(6, instanceCount)` |
| Tri vs batching | **Layers / buckets de z** : batch à l'intérieur d'un layer, ordre strict entre layers |
| Passes / cibles | Seam **`RenderPass` + `RenderTarget`** ; `beginFrame` ne hardcode plus clear/format |
| 3D-future | Interface **`Camera`** (`viewProjection: Mat4`) ; **shader library** au lieu de `createXShader()` |
| Réflexion | Étendre `WebGPUReflection` à `ResourceType.Storage` (bindings storage buffer) |

---

## 3. Design cible

### 3.1 Les trois couches

```
┌──────────────────────────────────────────────────────────┐
│ SCÈNE        SceneGraph, Node, Sprite, Camera, Animation   │  API user haut niveau
│              → produit des DrawCommand                     │
├──────────────────────────────────────────────────────────┤
│ RENDER       RenderQueue (collect + sort key),             │  agnostique (nebula)
│  (nouveau)   Batcher (SpriteBatch instancié),              │
│              PassGraph (scène → post → présent)            │
│              → produit des appels RHI                      │
├──────────────────────────────────────────────────────────┤
│ RHI/DEVICE   Renderer/ResourceFactory : buffers, textures, │  backend (nebula-webgpu)
│              pipelines (cachés), bind groups, draw          │
└──────────────────────────────────────────────────────────┘
```

Invariant conservé : la couche RENDER ne connaît **aucun** type backend ; elle parle `Renderer`/`Material`/`Geometry`/`DrawCommand`. Tout ce qui suit vit dans `nebula` sauf mention `[webgpu]`.

### 3.2 Pipeline caché + `RenderState` sur le Material

`Pipeline` sort de l'API publique. Le `Material` porte l'état de rendu et **résout** son pipeline à la volée via cache.

```ts
// nebula/core-types.ts
export type BlendMode = "opaque" | "alpha" | "additive" | "multiply";
export type RenderState = {
  readonly blend: BlendMode;
  readonly depthTest: boolean;   // ignoré en 2D pur, prêt pour la 3D
  readonly cull: "none" | "front" | "back";
};

// nebula/core/material/Material.ts
export interface Material extends Disposable {
  readonly shader: Shader;
  readonly renderState: RenderState;   // nouveau
  set(name: string, value: BindingValue): this;
  get<T extends BindingValue>(name: string): T;
}
```

Signature de dessin cible — le pipeline disparaît :

```ts
// AVANT
draw(geometry: Geometry, pipeline: Pipeline, material: Material, bindings: BindingGroup): void;
// APRÈS
draw(geometry: Geometry, material: Material, bindings: BindingGroup): void;
```

`[webgpu]` `draw` résout `pipeline = pipelineCache.getOrCreate(material.shader, geometry.layout, material.renderState)`. Le `WebGPUPipelineCache` (stub) est enfin câblé, keyé par `createPipelineId()`. Le guard `assertGeometryCompatibleWithPipeline` **disparaît** (impossible de désync par construction).

### 3.3 `DrawCommand` + clé de tri + `RenderQueue`

La scène ne dessine plus en immédiat pendant la traversée. Elle **remplit une file** de commandes triables.

```ts
// nebula/render/DrawCommand.ts
export type DrawCommand = {
  readonly sortKey: number;      // packé : layer | blend | pipelineId | textureId
  readonly geometry: Geometry;
  readonly material: Material;
  readonly instance: InstanceData; // model + uvRect + tint (cf. 3.4)
};

// nebula/render/RenderQueue.ts
export class RenderQueue {
  submit(cmd: DrawCommand): void;
  sort(): void;                  // un seul tri / frame
  flush(renderer: Renderer): void; // regroupe les commandes compatibles → batches
}
```

La clé de tri encode l'ordre **layer → blend → pipeline → texture → z**. Le tri regroupe naturellement les commandes batchables côte à côte ; `flush` fusionne les runs de même `(pipeline, texture, blend)` en un `SpriteBatch`.

### 3.4 SpriteBatch instancié (storage buffer)

**Décision : storage buffer + vertex pulling.** Pas de vertex/index buffer par sprite. Un tableau d'instances en `var<storage, read>`, le VS génère les 4 coins du quad depuis `@builtin(vertex_index)` et fetch l'instance depuis `@builtin(instance_index)`.

Struct d'instance (miroir de ce que `SpriteRenderer` calcule déjà aujourd'hui) :

```ts
// nebula/render/InstanceData.ts — 96 bytes, aligné 16
export type InstanceData = {
  readonly model: Mat4;    // 64  (compatible 3D ; 2D = matrice affine)
  readonly uvRect: Vec4;   // 16  (u0, v0, du, dv)
  readonly tint: Vec4;     // 16
};
```

Shader de sprite cible (`group(1)` passe de `uniform ObjectUniforms` → `storage array<Instance>`) :

```wgsl
struct Instance { model: mat4x4<f32>, uvRect: vec4<f32>, tint: vec4<f32> };
@group(1) @binding(0) var<storage, read> instances: array<Instance>;

const CORNERS = array<vec2<f32>, 6>(
  vec2(0.,0.), vec2(1.,0.), vec2(0.,1.),
  vec2(0.,1.), vec2(1.,0.), vec2(1.,1.));

@vertex
fn vs_main(@builtin(vertex_index) vi: u32,
           @builtin(instance_index) ii: u32) -> VertexOutput {
  let inst = instances[ii];
  let corner = CORNERS[vi];
  var out: VertexOutput;
  out.uv = inst.uvRect.xy + corner * inst.uvRect.zw;
  out.tint = inst.tint;
  out.position = uGlobal.viewProjection * inst.model * vec4(corner - 0.5, 0., 1.);
  return out;
}
```

Cycle par frame, par batch :
1. `flush` accumule les `InstanceData` d'un run compatible dans un `Float32Array` (packing par stride).
2. Un `GPUBuffer` storage dimensionné à `instanceCount` (ring/grow), ré-écrit via `writeBuffer` **seulement si le batch est dirty** (réutilise le tracking `version`).
3. `setBindGroup(1, batchBindGroup)` **une fois**, puis `renderPass.draw(6, instanceCount)`.

Gain : de *N* draws + *N* `writeBuffer` + *N* petits `GPUBuffer` → **1 draw + 1 writeBuffer + 1 buffer par batch**.

Tâches d'impl associées :
- `[webgpu]` `WebGPUReflection` : gérer `ResourceType.Storage` (aujourd'hui il *throw* sur tout sauf Uniform/Texture/Sampler).
- `nebula` : `BindingGroupLayoutHelper.packStorageArray(stride, count, getAt)` à côté de `packUniformBuffer` (même logique d'offsets réfléchis, itérée sur un stride).
- Le `objectDefinition` du sprite shader devient un binding storage ; le reste du flux réflexion→layout ne bouge pas.

### 3.5 Seam `RenderPass` / `RenderTarget`

`beginFrame`/`draw`/`endFrame` = **une passe hardcodée** (clear noir, présent direct). On introduit le seam sans l'implémenter à fond :

```ts
export interface RenderTarget { readonly width: number; readonly height: number; }
export type PassDescriptor = {
  readonly target: RenderTarget;         // canvas par défaut, ou texture offscreen
  readonly clear?: Color;                 // plus de noir hardcodé
  readonly depth?: boolean;
};
```

La scène passe par une **passe par défaut** identique au comportement actuel. Mais le seam permet ensuite : scène → passe post-process → présent (c'est le point d'accroche du futur `material-graph` et du post-processing). `WebGPURenderContext` porte déjà l'encoder + le pass ; il devient le support d'une passe paramétrée.

### 3.6 Ouvertures 3D (coût quasi nul aujourd'hui)

```ts
// nebula/core/camera/Camera.ts
export interface Camera { readonly viewProjection: Mat4; update(w: number, h: number): void; }
```

`Camera2D` implémente `Camera` ; `Renderer.camera: Camera` (au lieu de `Camera2D`). Le global group ne porte que `viewProjection + time` → déjà générique. Et `createSpriteShader()` est remplacé par une **shader library** fournie par le backend (registry keyé par nom : `"sprite"`, `"text"`, `"shape"`…), pour ne pas multiplier les `createXShader()` sur le contrat.

---

## 4. Ce qui est supprimé

- `WebGPUPipelineCache` **stub vide** → réécrit et câblé (3.2), ou supprimé si 3.2 le remplace ailleurs.
- `WebGPURenderState` **write-only** → soit utilisé pour l'élimination d'états redondants dans le `Binder`, soit supprimé. Décision : **le garder et l'exploiter** (skip `setPipeline`/`setBindGroup`/`setVertexBuffer` si identique à l'état courant).
- Guard `assertGeometryCompatibleWithPipeline` → **supprimé** (désync impossible après 3.2).
- Argument `pipeline` de `draw()` + création manuelle de `Pipeline` côté app → supprimés.
- `alphaBlend: true` hardcodé → remplacé par `material.renderState.blend`.

---

## 5. Plan de migration par phases

Ordre choisi = valeur décroissante, chaque phase livrable seule.

### Phase 0 — Nettoyage (débloque le reste) ✅
- [x] Exploiter `WebGPURenderState` dans `WebGPUBinder` (skip rebinds redondants) ou le supprimer.
- [x] Cacher les `GPUBindGroupLayout` par définition ; ne plus appeler `getBindGroupLayout` 3×/draw.
- [x] Rendre les `WebGPUGuard.assert*` du hot-path strippables (build flag / `__DEV__`).

### Phase 1 — Pipeline caché + RenderState ✅
- [x] `RenderState` + `BlendMode` dans `core-types` ; `Material.renderState`.
- [x] Câbler `WebGPUPipelineCache` (keyé par `createPipelineId`).
- [x] `createPipeline` respecte `renderState` (blend/depth/cull), plus de `alphaBlend` hardcodé.
- [x] Nouvelle signature `draw(geometry, material, bindings)` ; supprimer le guard de compat.
- [x] Migrer `SpriteRenderer` + apps (`apps/webgpu`, `apps/sandbox`).

> Note Phase 1 : `depthTest` est porté par `RenderState` mais **inerte** tant que la passe n'a pas de depth attachment (Phase 4). `createPipeline` a quitté le `ResourceFactory` public (pipeline = artefact interne, résolu par `getOrCreatePipeline`). La clé du `WebGPUPipelineCache` inclut `shader.id | vertexLayout | format | topology | blend | cull | depth`.

### Phase 2 — DrawCommand + RenderQueue
- [ ] `DrawCommand` + clé de tri packée + `RenderQueue` (`submit`/`sort`/`flush`) dans `nebula`.
- [ ] `SceneRenderer` remplit la queue au lieu de dessiner en immédiat.
- [ ] Culling sans alloc : `getCameraViewport` réutilisé, `getWorldBound` écrit dans un `Bound` scratch.
- [ ] Dirty-flag sur `Transformable` → `updateWorldMatrix` ne recalcule que les sous-arbres sales.

### Phase 3 — SpriteBatch instancié (storage buffer)
- [ ] `WebGPUReflection` gère `ResourceType.Storage`.
- [ ] `BindingGroupLayoutHelper.packStorageArray`.
- [ ] Sprite shader : `group(1)` → `var<storage, read> array<Instance>` + VS vertex-pulling.
- [ ] `SpriteBatch` : accumulation, buffer storage grow, `draw(6, instanceCount)`.
- [ ] `RenderQueue.flush` fusionne les runs `(pipeline, texture, blend)` en batches.
- [ ] Bench : viser 10k+ sprites stables.

### Phase 4 — Seam Pass / RenderTarget
- [ ] `RenderTarget` + `PassDescriptor` ; passe par défaut = comportement actuel.
- [ ] `beginFrame` paramétré (clear/format/depth), plus de noir hardcodé.
- [ ] Support d'une texture offscreen (préparation post-process / material-graph).

### Phase 5 — Ouvertures 3D
- [ ] Interface `Camera` ; `Renderer.camera: Camera`.
- [ ] Shader library backend (registry par nom) ; retirer `createSpriteShader` du contrat générique.

---

## 6. Invariants à ne pas casser

- **Core agnostique** : la couche RENDER (`RenderQueue`, `DrawCommand`, `SpriteBatch` abstrait) vit dans `nebula`, zéro type backend.
- **Réflexion = autorité du layout** : le passage uniform→storage se fait *via* la réflexion, pas de calcul d'offset à la main (cf. `shaders-materials-redesign.md`).
- **Un seul `set(name, value)`** : inchangé.
- **`set()` ne short-circuite jamais sur l'égalité de référence** : le dirty-tracking du batch réutilise `version` (cf. `nebula-webgpu/CLAUDE.md`).
