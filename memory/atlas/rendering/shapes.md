# Nebula — Rendu de formes / primitives (backlog A1)

> Statut : **implémenté** (backlog A1 clos). Le plan d'exécution détaillé (anciennement `shapes-primitives-plan.md`) a été fusionné ici une fois livré.
> Portée : `@atlasjs/nebula` (core, backend-agnostic) + `@atlasjs/nebula-webgpu` (backend WebGPU) + `apps/webgpu` (démo/validation).
> Contexte : suite directe de `memory/atlas/rendering/renderer-architecture.md`. Comblait le trou A1 : `Shape`/`Rect` existaient comme nœuds et `Shape.color` était déclaré, mais `SceneRenderer` ne dessinait que les `Sprite`. Ce design ajoute le rendu de **rects, cercles et lignes** en réutilisant l'infra batch instancié + shader library posée au refactor. Suites naturelles hors périmètre (strokes, coins arrondis, polygones, gradient) → `memory/atlas/backlog/`.

---

## 1. Objectif et périmètre

Dessiner trois primitives 2D pleines et colorées, intégrées au scene-graph et au tri painter's existant :

- **Rect** — quad coloré (le nœud existe déjà, il faut le dessiner).
- **Circle** — disque coloré (nouveau nœud).
- **Line** — segment épais coloré (nouveau nœud).

Contraintes directrices :

- **Réutiliser** le chemin instancié (storage buffer + `draw(6, N)`) et la shader library built-in, pas de nouveau mécanisme de batching.
- **Z-interleave correct** entre sprites et formes : une forme et un sprite au même endroit doivent respecter leur `zIndex` relatif (fond rect derrière un sprite, barre de vie rect devant, etc.).
- Respecter les invariants des deux packages : core **backend-agnostic** (aucun WGSL / `@webgpu/types` / import backend), WGSL comme source de vérité côté backend, reflection = autorité de layout.

Hors périmètre (YAGNI, suites naturelles) : contours/strokes (fill uniquement), coins arrondis, polygones arbitraires, remplissage par gradient/texture, anchor configurable par forme.

## 2. Insight central : trois primitives, un seul chemin instancié

Les trois primitives sont des **quads instanciés** partageant un unique struct d'instance :

```
Instance {
  model:  mat4x4<f32>   // world matrix (positionne/oriente/dimensionne le quad unitaire)
  color:  vec4<f32>     // couleur RGBA
  params: vec4<f32>     // params.x = shapeKind ; y/z/w réservés (coin arrondi, feather…)
}
```

| Primitive | Taille / forme                | `model`                                      | `shapeKind` |
|-----------|-------------------------------|----------------------------------------------|-------------|
| Rect      | `scale = (w, h)`              | `worldMatrix` (quad centré `-0.5..0.5`)      | `fill`      |
| Circle    | `radius` → `scale = (2r, 2r)` | `worldMatrix`                                | `circle`    |
| Line      | `start`, `end` + `thickness`  | `worldMatrix · lineMatrix(start,end,thick)`  | `fill`      |

- La **ligne est un rect fin orienté** : même remplissage plein que le rect, seul son `model` est calculé depuis ses deux points.
- Le **cercle** partage le quad du rect : c'est le fragment shader qui découpe un disque via SDF. Seul `shapeKind` les distingue.
- Un `Circle` avec un scale non-uniforme produit une **ellipse** (comportement attendu, gratuit).

Conséquence : **un seul shader built-in `"shape"`, un seul `ShapeBatch`, un seul struct d'instance** couvrent les trois. Aucune géométrie custom, aucune texture. Toutes les formes d'un `renderState` donné collapsent en **un seul batch**.

## 3. Couche nœuds (`@atlasjs/nebula`, `graphics/`)

`Shape extends Node` reste la base et porte :

- `color: Color` (déjà présent).
- `blend: BlendMode`, défaut **`"alpha"`** — nécessaire pour que les couleurs semi-transparentes et l'antialiasing du cercle (bord à alpha partiel) fonctionnent.

Nœuds concrets (tous `extends Shape`) :

- **`Rect`** (existe) — inchangé côté API : `width`/`height` mappés sur `transform.scale`, `setSize(w, h)`.
- **`Circle`** (nouveau) — `radius: number` (get/set) mappé sur `transform.scale = (2r, 2r)`, pour rester cohérent avec le modèle « taille portée par le scale » de `Rect`.
- **`Line`** (nouveau) — `start: Vec2`, `end: Vec2` (coordonnées **locales**), `thickness: number`. Cas assumé à part : sa géométrie vient de ses deux points, pas du `transform` standard, mais elle respecte quand même le `worldMatrix` parent (composition `worldMatrix · lineMatrix`).

**Origine des formes : centrée.** La position d'un nœud = centre de la forme, cohérent avec le quad unitaire `-0.5..0.5` et avec l'anchor `0.5` par défaut des sprites.

Un `Shape` nu (ni `Rect`, ni `Circle`, ni `Line`) n'est pas dessiné.

Exports ajoutés dans `graphics/index.ts` (`Circle`, `Line`).

## 4. Couche render (`@atlasjs/nebula`, `renderers/`)

### 4.1 `DrawCommand` — union taguée

```
type DrawCommand = SpriteDrawCommand | ShapeDrawCommand
```

- Tronc commun : `{ kind: "sprite" | "shape", sortKey: number, batchKey: number, renderState: RenderState }`.
- `SpriteDrawCommand` : + `texture`, `sampler`, `model`, `uvRect`, `tint`.
- `ShapeDrawCommand` : + `model`, `color`, `params` (`params.x = shapeKind`).

Le narrowing par `kind` se fait dans la `RenderQueue` avant l'accès aux champs spécifiques.

### 4.2 `ShapeRenderer` (nouveau, miroir de `SpriteRenderer`)

- `buildCommand(shape: Shape): ShapeDrawCommand | null` — dispatch par type concret (`Rect`/`Circle`/`Line`) pour calculer `model` + `shapeKind` ; retourne `null` pour un `Shape` nu.
- Cache les render-data (`model`, `color`, `params`) en `WeakMap<Shape, …>`, comme `SpriteRenderer`.
- `batchKey` dérivé du `renderState` (blend) : toutes les formes du même blend partagent un batch (pas de texture à discriminer).
- `sortKey` : même schéma que les sprites (z-index dominant, puis batchId), pour que sprites et formes se trient dans une file commune.
- Calcul du `model` :
  - Rect/Circle : `model = worldMatrix` (le scale porte la taille).
  - Line : `lineMatrix` = translate au milieu de `(start, end)`, rotation vers l'angle du segment, scale `(longueur, thickness)` ; puis `model = worldMatrix · lineMatrix`.

### 4.3 `RenderQueue` — batchers par `kind`

- File unique triée par `sortKey` → **z-interleave sprite↔shape préservé**.
- `flush` regroupe les runs consécutifs par `(kind, batchKey)` et délègue à un **batcher** choisi par `kind` :
  - `SpriteBatcher` — extrait du `flush` actuel (begin texture/sampler/renderState, add model/uvRect/tint).
  - `ShapeBatcher` — nouveau (begin renderState, add model/color/params).
- Un run se termine quand `kind` **ou** `batchKey` change. Le batcher fait `begin` → `add*` → `draw` via `renderer.drawInstancedBatch(batch)`.
- Extensible : le texte (backlog A2) se branchera comme 3ᵉ batcher sans toucher la file.

### 4.4 `SceneRenderer` — dispatch + cull

- `collect` : `if (node instanceof Sprite)` → `spriteRenderer` ; `else if (node instanceof Shape)` → `shapeRenderer` (submit uniquement si non-`null`).
- Cull viewport par world-bound, en parité avec les sprites :
  - Rect/Circle : bbox des coins du quad transformés.
  - Line : bbox des deux endpoints (en tenant compte de `thickness`).
- Détient les deux renderers et les deux batches (`spriteBatch`, `shapeBatch`).

### 4.5 Interfaces `core/renderer/`

- `SpriteBatch.ts` : introduit `InstancedBatch`, la surface **backend-agnostic** minimale que la file et le draw manipulent (`__kind`, `count`, `renderState`) ; `SpriteBatch` et le nouveau `ShapeBatch` l'étendent avec leur `add` spécifique (`add(model, uvRect, tint)` vs `add(model, color, params)`). Les concepts backend (`pack()`/`byteSize`/`storageBinding`/`materialBindings`) **restent côté WebGPU** sur les classes concrètes — `drawInstancedBatch` caste en interne, exactement comme `drawSpriteBatch` caste aujourd'hui en `WebGPUSpriteBatch`.
- `Renderer.ts` : `drawSpriteBatch(batch)` → **`drawInstancedBatch(batch: InstancedBatch)`** (le core ne connaît que `InstancedBatch`, le backend caste).
- `ResourceFactory.ts` : `createSpriteBatch()` rejoint par `createShapeBatch()`.

## 5. Backend WebGPU (`@atlasjs/nebula-webgpu`)

### 5.1 Shader `shaders/shape_instanced.wgsl` (built-in `"shape"`)

- `@group(1) @binding(0) var<storage, read> instances: array<Instance>` avec `Instance { model, color, params }`.
- **Pas de `@group(2)`** (aucune texture) → layout de pipeline `[global, storage]`.
- VS : quad unitaire 6 verts (comme `sprite_instanced.wgsl`), `out.position = uGlobal.viewProjection * instance.model * vec4(corner, 0, 1)` ; passe `color`, `params` et l'UV local `[-0.5, 0.5]` au FS.
- FS : `if (params.x == CIRCLE)` → SDF disque (`d = length(localUv)`, `coverage = 1 - smoothstep(0.5 - fwidth(d), 0.5, d)`), `alpha = color.a * coverage` ; sinon fill plein `color`. Sortie alignée sur la convention alpha/premultiplied du shader sprite existant.

Enregistrement dans `WebGPUShaderList` (`WebGPUShaders.ShapeInstanced`) et `WebGPUBuiltinShaders["shape"]`.

### 5.2 Batchs — factorisation

- **`WebGPUInstancedBatch`** (base interne, nouveau) : porte la reflection du storage (`WebGPUReflectedStorage`), les lignes d'instances, et le générique `pack()` / `byteSize` / `storageBinding` (tout ce que `WebGPUSpriteBatch` fait déjà de non-spécifique). Non exposé hors backend.
- **`WebGPUSpriteBatch`** : dérive de la base ; ajoute les `materialBindings` (texture + sampler) et le provider `model`/`uvRect`/`tint`.
- **`WebGPUShapeBatch`** : dérive de la base ; **pas de `materialBindings`** ; provider `model`/`color`/`params`.

### 5.3 `drawInstancedBatch(batch)` unifié

Remplace `drawSpriteBatch`. Un seul chemin pour sprite et shape :

1. `count === 0` → early return.
2. Résout le shader du batch (built-in `"sprite"` ou `"shape"`) et le pipeline instancié (keyé `format | blend | cull`).
3. Bind `group 0` (global) + `group 1` (storage packé via l'`InstanceBufferPool`).
4. Bind `group 2` (material) **seulement si `batch.materialBindings` est présent** (sprite oui, shape non).
5. `pass.draw(6, batch.count)`.

`createShapeBatch()` : `new WebGPUShapeBatch(getBuiltinShader("shape"))`.

## 6. Flux de rendu (bout-en-bout)

1. `SceneRenderer.render` : `updateWorldMatrices`, récupère le viewport caméra.
2. `collect` traverse le graphe : sprites → `SpriteRenderer`, formes → `ShapeRenderer` ; chaque commande cull-testée puis `queue.submit`.
3. `queue.sort` (par `sortKey`, z dominant) → sprites et formes entrelacés.
4. `queue.flush` : pour chaque run `(kind, batchKey)`, le batcher correspondant remplit son batch et appelle `renderer.drawInstancedBatch(batch)`.
5. Backend : pipeline instancié résolu, groupes bindés (group 2 optionnel), `draw(6, count)`.

## 7. Trade-offs assumés

1. **Refactor d'un chemin sprite qui marche** (extraction `SpriteBatcher`, union `DrawCommand`, `drawSpriteBatch`→`drawInstancedBatch`) : risque de régression sprite, mitigé par la validation visuelle des apps.
2. **`DrawCommand` en union** : narrowing par `kind` nécessaire, léger surcoût de types dans `RenderQueue` — accepté pour la propreté vs champs optionnels incohérents.
3. **SDF cercle en fragment shader** : le quad plein est payé en fillrate même hors du disque (négligeable en 2D) ; AA analytique via `fwidth` (pas de MSAA), standard et suffisant.
4. **`Line` hors modèle transform/scale** : géométrie dérivée de `(start, end, thickness)`, petite asymétrie d'API assumée ; respecte quand même le parent.
5. **`shapeKind` = branchement FS** : divergence de warp théorique entre rects et cercles d'un même batch, impact nul aux volumes 2D ; justifierait un split rect/cercle seulement à très grande échelle (pas maintenant).

## 8. Vérification

Pas de tests unitaires sur le rendu → **validation visuelle via `apps/webgpu`** :

- Scène de démo posant un `Rect`, un `Circle`, une `Line` **et** un `Sprite` à des `zIndex` entrelacés (ex. rect derrière le sprite, cercle devant) pour prouver le tri painter's unifié.
- Outils Browser : `read_console_messages` / `preview_logs` (zéro erreur WebGPU), screenshot (formes visibles, bord de cercle propre, ligne bien orientée), non-régression du rendu sprite existant.
- `pnpm build` vert sur `nebula` puis `nebula-webgpu` (ordre turbo `^build`).

## 9. Fichiers touchés

**`@atlasjs/nebula` (core)**

- `graphics/Shape.ts` (blend + base), `graphics/Circle.ts` (nouveau), `graphics/Line.ts` (nouveau), `graphics/index.ts` (exports)
- `renderers/DrawCommand.ts` (union), `renderers/ShapeRenderer.ts` (nouveau), `renderers/RenderQueue.ts` (batchers par kind), `renderers/SceneRenderer.ts` (dispatch + cull), `renderers/SpriteRenderer.ts` (extraction `SpriteBatcher`), `renderers/index.ts`
- `core/renderer/Renderer.ts` (`drawInstancedBatch`), `core/renderer/ResourceFactory.ts` (`createShapeBatch`), `core/renderer/SpriteBatch.ts` (`InstancedBatch` / `ShapeBatch`)

**`@atlasjs/nebula-webgpu` (backend)**

- `shaders/shape_instanced.wgsl` (nouveau), `resources/WebGPUShaderList.ts` (built-in `"shape"`)
- `batch/WebGPUInstancedBatch.ts` (base, nouveau), `batch/WebGPUShapeBatch.ts` (nouveau), `batch/WebGPUSpriteBatch.ts` (dérive de la base), `batch/index.ts`
- `WebGPURenderer.ts` (`drawInstancedBatch` unifié, `createShapeBatch`, group 2 optionnel)

**Apps**

- `apps/webgpu/src/*` (scène de démo shapes + non-régression)

## 10. Ordre d'implémentation suggéré

1. Nœuds core : `Shape` (blend), `Circle`, `Line`, exports.
2. Interfaces core : `InstancedBatch`/`ShapeBatch`, `Renderer.drawInstancedBatch`, `ResourceFactory.createShapeBatch`.
3. Backend : `WebGPUInstancedBatch` base, refonte `WebGPUSpriteBatch` dessus, `drawInstancedBatch` unifié — **valider la non-régression sprite ici**.
4. Shader `shape_instanced.wgsl` + built-in `"shape"` + `WebGPUShapeBatch` + `createShapeBatch`.
5. Render layer core : `DrawCommand` union, `ShapeRenderer`, `RenderQueue` batchers, `SceneRenderer` dispatch + cull.
6. Démo `apps/webgpu` + validation visuelle bout-en-bout (rects, cercles, lignes, z-interleave).
