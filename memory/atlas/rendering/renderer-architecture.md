---
status: implemented
summary: "Refonte de l'architecture du renderer implémentée : phases 0 à 5 ; reste ouvert au backlog."
---
# Nebula — Refonte Architecture du Renderer

> Statut : **implémenté** (6 phases 0→5 + dirty-flag + tint/blend par sprite). Durcissement post-refactor : voir l'appendice « Refactor plans » en bas. Reste ouvert (text, post-process, depth 3D, resource lifecycle) → `memory/atlas/backlog/`.
> Portée : `@atlasjs/nebula` (contrats + couche render agnostique) + `@atlasjs/nebula-webgpu` (impl)
> Objectif : passer d'un renderer « draw immédiat, 1 sprite = 1 draw call » à un renderer scalable et ergonomique, sans casser le split backend-agnostique ni l'autorité de la réflexion WGSL.
> Prérequis de lecture : `memory/atlas/rendering/shaders-materials.md` (implémenté). Ce doc en est la suite logique côté pipeline de soumission.

---

## 1. Le problème

L'architecture actuelle a **deux couches saines** mais **il manque celle du milieu** :

- **RHI / device** (`WebGPURenderer` : buffers, textures, pipelines, `draw`) — solide.
- **Scène** (`SceneGraph`, `Node`, `Sprite`, `SceneRenderer`) — correcte mais naïve.

Entre les deux, aucune couche de **soumission** (batching, tri, résolution de pipeline, file de commandes). Conséquence directe : **1 sprite = 1 draw call + rebind de 3 bind groups**, et la scène est intégralement retravaillée chaque frame.

### Défauts constatés

| #   | Constat                                                                                                                                                                                                                                                         | Fichier                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | `draw(geometry, pipeline, material, bindings)` : 4 objets redondants (le pipeline connaît sa géométrie + son shader, le material connaît son shader) → désync possible, d'où le guard `assertGeometryCompatibleWithPipeline` qui n'existe que pour rattraper ça | `WebGPURenderer.ts`                                       |
| 2   | `WebGPUPipelineCache` = **stub vide**, jamais câblé. `createPipeline` fait toujours un `new WebGPUPipeline`. Le user doit créer/porter le `Pipeline` à la main                                                                                                  | `caches/WebGPUPipelineCache.ts`                           |
| 3   | `WebGPURenderState` **write-only** : le binder écrit `pipeline/geometry/bindGroups`, personne ne les lit pour éliminer les rebinds redondants                                                                                                                   | `states/WebGPURenderState.ts`, `bindings/WebGPUBinder.ts` |
| 4   | 1 sprite = 1 draw call. `objectBindingGroup` = 1 `GPUBuffer` + 1 `writeBuffer` **par sprite** → meurt vers quelques centaines de sprites                                                                                                                        | `renderers/SpriteRenderer.ts`                             |
| 5   | `alphaBlend: true` **hardcodé** dans `createPipeline` malgré `PipelineDescriptor.alphaBlend`. Aucun contrôle blend/depth/cull nulle part                                                                                                                        | `WebGPURenderer.ts`                                       |
| 6   | `getBindGroupLayout(index)` appelé 3× / draw + `device.createBindGroupLayout` inline non-cachés (2 pipelines même shader = layouts dupliqués)                                                                                                                   | `WebGPURenderer.ts`                                       |
| 7   | Culling allocatoire : `getCameraViewport()` alloue un `Bound` **par sprite**, `getWorldBound()` ~6 `Vec2`+`Bound` **par sprite / frame**                                                                                                                        | `renderers/SceneRenderer.ts`, `graphics/Sprite.ts`        |
| 8   | Scène retravaillée en entier chaque frame : `updateWorldMatrices` sans dirty-flag, `getNodesArraySorted` réalloue + re-sort                                                                                                                                     | `graphics/Node.ts`, `renderers/SceneRenderer.ts`          |
| 9   | `Renderer.camera: Camera2D` fige la 2D dans le **contrat**                                                                                                                                                                                                      | `core/renderer/Renderer.ts`                               |
| 10  | `createSpriteShader()` sur le `ResourceFactory` générique → ne scale pas (futurs `createTextShader`, `createShapeShader`…)                                                                                                                                      | `core/renderer/ResourceFactory.ts`                        |

---

## 2. Décisions de design

| Décision                         | Choix retenu                                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Objet public de dessin           | **`Material` + `Geometry`** ; `Pipeline` devient un artefact **interne caché**, résolu et caché                            |
| Résolution de pipeline           | **`PipelineCache`** keyé par `(shader, vertexLayout, renderState)` — le `createPipelineId()` déjà calculé                  |
| État de rendu (blend/depth/cull) | Porté par le **`Material`** (`RenderState`), plus jamais hardcodé                                                          |
| Soumission                       | **`DrawCommand` + clé de tri packée + `RenderQueue`** dans `nebula` (agnostique)                                           |
| Batching                         | **Storage buffer + instancing** : quad généré en VS, tableau d'instances en `var<storage, read>`, `draw(6, instanceCount)` |
| Tri vs batching                  | **Layers / buckets de z** : batch à l'intérieur d'un layer, ordre strict entre layers                                      |
| Passes / cibles                  | Seam **`RenderPass` + `RenderTarget`** ; `beginFrame` ne hardcode plus clear/format                                        |
| 3D-future                        | Interface **`Camera`** (`viewProjection: Mat4`) ; **shader library** au lieu de `createXShader()`                          |
| Réflexion                        | Étendre `WebGPUReflection` à `ResourceType.Storage` (bindings storage buffer)                                              |

---

## 3. Design cible

### 3.1 Les trois couches

```
┌──────────────────────────────────────────────────────────┐
│ SCÈNE        SceneGraph, Node, Sprite, Camera, Animation │  API user haut niveau
│              → produit des DrawCommand                   │
├──────────────────────────────────────────────────────────┤
│ RENDER       RenderQueue (collect + sort key),           │  agnostique (nebula)
│  (nouveau)   Batcher (SpriteBatch instancié),            │
│              PassGraph (scène → post → présent)          │
│              → produit des appels RHI                    │
├──────────────────────────────────────────────────────────┤
│ RHI/DEVICE   Renderer/ResourceFactory : buffers, textures│  backend (nebula-webgpu)
│              pipelines (cachés), bind groups, draw       │
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
  readonly depthTest: boolean; // ignoré en 2D pur, prêt pour la 3D
  readonly cull: "none" | "front" | "back";
};

// nebula/core/material/Material.ts
export interface Material extends Disposable {
  readonly shader: Shader;
  readonly renderState: RenderState; // nouveau
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
  readonly sortKey: number; // packé : layer | blend | pipelineId | textureId
  readonly geometry: Geometry;
  readonly material: Material;
  readonly instance: InstanceData; // model + uvRect + tint (cf. 3.4)
};

// nebula/render/RenderQueue.ts
export class RenderQueue {
  submit(cmd: DrawCommand): void;
  sort(): void; // un seul tri / frame
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
  readonly model: Mat4; // 64  (compatible 3D ; 2D = matrice affine)
  readonly uvRect: Vec4; // 16  (u0, v0, du, dv)
  readonly tint: Vec4; // 16
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

Gain : de _N_ draws + _N_ `writeBuffer` + _N_ petits `GPUBuffer` → **1 draw + 1 writeBuffer + 1 buffer par batch**.

Tâches d'impl associées :

- `[webgpu]` `WebGPUReflection` : gérer `ResourceType.Storage` (aujourd'hui il _throw_ sur tout sauf Uniform/Texture/Sampler).
- `nebula` : `BindingGroupLayoutHelper.packStorageArray(stride, count, getAt)` à côté de `packUniformBuffer` (même logique d'offsets réfléchis, itérée sur un stride).
- Le `objectDefinition` du sprite shader devient un binding storage ; le reste du flux réflexion→layout ne bouge pas.

### 3.5 Seam `RenderPass` / `RenderTarget`

`beginFrame`/`draw`/`endFrame` = **une passe hardcodée** (clear noir, présent direct). On introduit le seam sans l'implémenter à fond :

```ts
export interface RenderTarget {
  readonly width: number;
  readonly height: number;
}
export type PassDescriptor = {
  readonly target: RenderTarget; // canvas par défaut, ou texture offscreen
  readonly clear?: Color; // plus de noir hardcodé
  readonly depth?: boolean;
};
```

La scène passe par une **passe par défaut** identique au comportement actuel. Mais le seam permet ensuite : scène → passe post-process → présent (c'est le point d'accroche du futur `material-graph` et du post-processing). `WebGPURenderContext` porte déjà l'encoder + le pass ; il devient le support d'une passe paramétrée.

### 3.6 Ouvertures 3D (coût quasi nul aujourd'hui)

```ts
// nebula/core/camera/Camera.ts
export interface Camera {
  readonly viewProjection: Mat4;
  update(w: number, h: number): void;
}
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
- [x] Migrer `SpriteRenderer` + apps (`apps/webgpu`, `apps/dino-brawl`).

> Note Phase 1 : `depthTest` est porté par `RenderState` mais **inerte** tant que la passe n'a pas de depth attachment (Phase 4). `createPipeline` a quitté le `ResourceFactory` public (pipeline = artefact interne, résolu par `getOrCreatePipeline`). La clé du `WebGPUPipelineCache` inclut `shader.id | vertexLayout | format | topology | blend | cull | depth`.

### Phase 2 — DrawCommand + RenderQueue ✅ (dirty-flag différé)

- [x] `DrawCommand` + clé de tri packée + `RenderQueue` (`submit`/`sort`/`flush`) dans `nebula`.
- [x] `SceneRenderer` remplit la queue au lieu de dessiner en immédiat.
- [x] Culling sans alloc : `getCameraViewport` récupéré 1×/frame, `getWorldBound(out)` écrit dans un `Bound` scratch (coins transformés inline, sans `Vec2`).
- [x] Dirty-flag sur `Transformable` → `updateWorldMatrix` ne recalcule que les sous-arbres sales (fait après coup, cf. note ci-dessous).

> Notes Phase 2 :
>
> - **Clé de tri packée** (`SpriteRenderer.computeSortKey`) : `zNorm * 65536 + batchId`, `zNorm = clamp(round(zIndex) + 32768, 0, 65535)`, `batchId` = id incrémental par clé matériau (`texture.id|sampler.id`). Tri croissant = ordre peintre (z bas derrière), regroupé par matériau à z égal → prêt pour le batching Phase 3.
> - **Fix d'aliasing** : le `model` matrix partagé (`this.modelMatrix`) est remplacé par une `SpriteRenderData` par sprite (`bindings` + `model` + `sourceRect`), mutée en place + `set()` (bump `version`). Requis dès qu'on diffère le draw (sinon toutes les commandes lisaient la dernière matrice).
> - **Ordre corrigé** : `updateWorldMatrices()` passe **avant** le culling (avant : culling en retard d'une frame sur des world matrices périmées).
> - **Dirty-flag (fait)** : `Transformable.transform` est passé de `Transform2D` à `ObservableTransform2D` — un `Observable` (`@atlasjs/utils`) lève un flag `localDirty` sur **toute** mutation, y compris les écritures directes (`transform.position.x += …`, `transform.rotation = …`, `Sprite.flipX`, `Rect.width =`). `Node.updateWorldMatrix(parentWorld?, parentChanged?)` ne reconstruit `transformMatrix` que si `localDirty` et `worldMatrix` que si `localDirty || parentChanged`, puis propage `changed` aux enfants ; `addChild` marque le nœud déplacé dirty. `Mat4.fromTransform2D` élargi à `Transform2DLike` (élargissement rétro-compatible). Vérifié : sprite animé par écriture directe → bouge/tourne (pas figé) ; scène statique OK.

### Phase 3 — SpriteBatch instancié (storage buffer) ✅

- [x] `WebGPUReflection` gère `ResourceType.Storage` → expose `{ binding, stride, members }`.
- [x] `BindingGroupLayoutHelper.packStorageArray` (offsets/stride réfléchis).
- [x] Sprite shader `sprite_instanced.wgsl` : `group(1)` → `var<storage, read> array<Instance>` + VS vertex-pulling (`vertex_index`/`instance_index`).
- [x] `SpriteBatch` (contrat `createSpriteBatch`/`drawSpriteBatch`) : accumulation CPU, pool de buffers storage par frame (grow), `draw(6, instanceCount)`.
- [x] `RenderQueue.flush` fusionne les runs consécutifs de même `batchKey` en un `drawSpriteBatch`.
- [x] Bench : 20k sprites (même texture) rendus en **1 draw call**, animés, sans erreur de validation (preuve visuelle ; FPS non mesurable de façon fiable dans le navigateur d'automation à cause du throttling rAF).

> Notes Phase 3 :
>
> - **Contrat** : ajout de `SpriteBatch` + `createSpriteBatch()` (ResourceFactory) + `drawSpriteBatch(batch)` (Renderer), à côté du `draw(geometry, material, bindings)` générique (chemin material custom, inchangé). Le chemin sprite est spécialisé instancié.
> - **`SpriteRenderer` simplifié** : n'est plus qu'un producteur de `DrawCommand` (model + uvRect + sortKey/batchKey). Plus de per-object bind group, plus de material par sprite, plus de géométrie quad (générée dans le VS) — le batch bind texture/sampler (group 2) + storage (group 1).
> - **Pool de buffers storage** (`WebGPUInstanceBufferPool`) : un buffer par run par frame, recyclé au `beginFrame`. Réutiliser un seul buffer pour plusieurs runs clobberait les runs précédents (tous les draws lisent le dernier upload).
> - **Pipeline instancié à layout explicite** (pas `auto`) : réutilise les GPU layouts cachés (global/material) → bind groups compatibles et robustes (évite le footgun des auto-layouts non-compatibles entre pipelines).
> - **`InstanceData`** = `{ model: mat4, uvRect: vec4, tint: vec4 }` (stride 96, offsets réfléchis).
> - **Tint par sprite (fait)** : `Sprite.tint: Vec4` (défaut blanc) + `setTint(r,g,b,a)`. La teinte est **par-instance** (dans le storage buffer) — des sprites de teintes différentes restent dans le **même** batch tant que texture/sampler/blend sont identiques. Vérifié visuellement.
> - **Blend par sprite (fait)** : `Sprite.blend: BlendMode` (défaut `alpha`) + `setBlend(...)`. Le `batchKey` inclut le blend (`texture|sampler|blend`), donc des blends différents forment des batches/pipelines distincts (partage global correct car layouts explicites). Vérifié (paire additive → chevauchement plus clair).

### Phase 4 — Seam Pass / RenderTarget ✅

- [x] `RenderTarget` (extends `Texture2D` + `format`) + `PassDescriptor` ; passe par défaut = comportement actuel (canvas + clear noir).
- [x] `beginFrame(pass?)` paramétré (target + clear color), plus de noir hardcodé ; format de passe threadé dans les deux pipelines (indexé + instancié).
- [x] Support d'une texture offscreen : `createRenderTarget()` → cible rendable ET échantillonnable (réutilise `WebGPUTexture2D`, déjà `RENDER_ATTACHMENT`). Plumbing haut niveau : `NebulaRenderer.render(pass?)` → `SceneRenderer.render(scene, pass?)`.

> Notes Phase 4 :
>
> - **Format par passe** : `WebGPURenderContext` porte le `format` de la cible ; `getOrCreatePipeline`/`getInstancedPipeline` sont keyés par ce format (une cible offscreen d'un format différent du canvas crée ses propres pipelines). Vérifié : scène rendue dans un target `rgba8unorm` puis blittée sur canvas (formats distincts) sans mismatch.
> - **Render-to-texture vérifié de bout en bout** : passe 1 scène → target offscreen (clear bleu), passe 2 target → canvas via un `Sprite` texturé par le target (le `RenderTarget` étant un `Texture2D`, aucun shader de blit dédié n'est nécessaire). C'est le point d'accroche du post-process / material-graph.
> - **Multi-passe** = plusieurs cycles `beginFrame(pass)`/`endFrame` (un command buffer + un submit par passe) ; le pool d'instances est reset à chaque `beginFrame`.
> - **`depthTest`** toujours inerte (pas de depth attachment) — la 3D branchera un depth sur `PassDescriptor.depth`.

### Phase 5 — Ouvertures 3D ✅

- [x] Interface `Camera` (`viewProjection` + `update`) ; `Camera2D implements Camera` ; `Renderer.camera: Camera`.
- [x] Shader library backend (`WebGPUBuiltinShaders`, registry nom → descripteur) ; `getBuiltinShader(name)` remplace `createSpriteShader` (retiré du contrat) ; `createSpriteBatch`/le chemin instancié résolvent le shader via `getBuiltinShader("sprite")`.

> Notes Phase 5 :
>
> - **Camera** : le contrat RHI ne dépend plus que de l'abstraction (`viewProjection`/`update`) — un `Camera3D` s'y branche sans toucher le renderer. `WebGPURenderer.camera` reste un `Camera2D` concret (le culling 2D `getCameraViewport` utilise `zoom`/`position`). `NebulaRenderer` (facade 2D) ré-expose `Camera2D` — ergonomie 2D préservée (`.zoom`, `.position`).
> - **`getCameraViewport`** reste un helper de culling 2D sur le contrat ; une variante 3D le remplacerait/ignorerait (hors périmètre — on ouvre les ouvertures, on n'implémente pas la 3D).
> - **Shader library** : extension point unique keyé par nom au lieu d'un `createXShader()` par shader. Built-ins actuels : `"sprite"` (instancié), `"texture"`.

---

## 6. Invariants à ne pas casser

- **Core agnostique** : la couche RENDER (`RenderQueue`, `DrawCommand`, `SpriteBatch` abstrait) vit dans `nebula`, zéro type backend.
- **Réflexion = autorité du layout** : le passage uniform→storage se fait _via_ la réflexion, pas de calcul d'offset à la main (cf. `memory/atlas/rendering/shaders-materials.md`).
- **Un seul `set(name, value)`** : inchangé.
- **`set()` ne short-circuite jamais sur l'égalité de référence** : le dirty-tracking du batch réutilise `version` (cf. `nebula-webgpu/CLAUDE.md`).

---

## 7. Appendice — Refactor plans (durcissement post-refactor, ✅ livré)

Une fois l'architecture ci-dessus en place, deux plans de durcissement ont été exécutés pour dédupliquer et fiabiliser la soumission. Ils sont **terminés** ; leur détail pas-à-pas (anciens `renderer-refactor-plan-d3-e2-e1.md` et `renderer-refactor-plan-e3.md`) est résumé ici.

### 7.1 Backend WebGPU — `@atlasjs/nebula-webgpu` (D3 + E2 + E1)

- **D3 — desync d'état sur draw instancié** : les draws instanciés passent désormais par le `WebGPUBinder` existant (plus de state désynchronisé entre chemin instancié et chemin classique).
- **E2 — unification des pipelines** : les deux systèmes de pipeline parallèles sont regroupés derrière un unique `WebGPUPipelineFactory` + une seule clé de cache (absorbe le bug de layout de storage partagé, D4).
- **E1 — éclatement du god-object** : `WebGPURenderer` allégé par extraction de `WebGPUSurface` et `WebGPUFrameGlobals`.
- Reste noté : `topology` n'a pas de canal dans `PipelineKeySpec` (inerte tant que tout est `triangle-list`) ; `WebGPURenderer` encore ~540 lignes (extractions futures possibles) → `memory/atlas/backlog/`.

### 7.2 Core agnostique — `@atlasjs/nebula` (E3)

- **E3 — seam `NodeRenderer`** : le dispatch node→draw, auparavant codé en dur à 6 endroits et dupliqué entre `SpriteRenderer`/`ShapeRenderer`, passe derrière un seul seam `NodeRenderer` + un `Map<kind, Batcher>` dans `RenderQueue` + un `NodeRendererBase` partagé. `SceneRenderer.collect` devient générique : un nouveau kind (text, particules) se branche sans toucher la machinerie de dispatch.
- Écart d'implémentation vs plan : le culling est resté dans un `collect(node, viewport, scratch)` par renderer (au lieu du build→bound→cull générique) pour préserver le z-order exact ; l'interface a shippé en `{ kind; matches; collect; createBatcher }`.
- Prochain consommateur visé : le **text rendering** (backlog A2) se branchera comme batcher sur ce seam → [`memory/atlas/backlog/RENDER-01-text-rendering.md`](../backlog/RENDER-01-text-rendering.md).
