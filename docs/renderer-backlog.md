# Nebula — Backlog / Pistes de travail

> Statut : **backlog** (sections A/B/C, candidats non planifiés) + **findings de review confirmés** (sections D/E, audit du 2026-07-14 sur `nebula` / `nebula-webgpu`)
> Portée : `@atlasjs/nebula` (+ `@atlasjs/nebula-webgpu`, `@atlasjs/editor`)
> Contexte : le refactor renderer est terminé (voir `docs/renderer-architecture-redesign.md`, 6 phases + dirty-flag + tint/blend par sprite tous faits). Ce doc liste les suites naturelles et la dette repérée pendant ce refactor, plus les findings d'une passe de review dédiée (D/E), pour reprise directe.

Ordre conseillé en bas du doc (worklist priorisée, review fondue).

---

## A. Suites naturelles du renderer (bâtissent sur l'archi en place)

### A1. Rendu de formes / primitives — **✅ fait** (voir `docs/shapes-primitives-design.md`)

- **Constat** : `Shape` et `Rect` existaient comme nœuds et `Shape.color` était déclaré, mais `SceneRenderer` ne dessinait **que** les `Sprite`. Rects/formes/lignes ne s'affichaient pas ; `Shape.color` était inutilisé.
- **Livré** : rendu de **rects, cercles et lignes** pleins et colorés, tous en quads instanciés partageant un unique shader built-in `"shape"` (`Instance { model, color, params }`, SDF disque avec AA `fwidth` pour le cercle, ligne = rect fin orienté). `Circle`/`Line` ajoutés comme nœuds, `Shape.blend` (défaut `alpha`). Couche render : `DrawCommand` en union taguée (`kind`), `ShapeRenderer`, batchers par kind dans une `RenderQueue` unique (z-interleave sprite↔formes préservé), dispatch + cull viewport dans `SceneRenderer`. Chemin de draw instancié unifié `drawSpriteBatch` → `drawInstancedBatch` (group material optionnel), base backend `WebGPUInstancedBatch` partagée par `WebGPUSpriteBatch`/`WebGPUShapeBatch`.
- **Fichiers** : `packages/nebula/src/graphics/{Shape,Circle,Line}.ts`, `packages/nebula/src/renderers/{DrawCommand,ShapeRenderer,Batchers,RenderQueue,SceneRenderer,SpriteRenderer}.ts`, `core/renderer/{SpriteBatch,Renderer,ResourceFactory}.ts` ; `packages/nebula-webgpu/src/shaders/shape_instanced.wgsl`, `batch/{WebGPUInstancedBatch,WebGPUShapeBatch,WebGPUSpriteBatch}.ts`, `resources/WebGPUShaderList.ts`, `WebGPURenderer.ts` ; démo `apps/webgpu/src/index.ts`.
- **Hors scope (suites)** : contours/strokes (fill uniquement), coins arrondis, polygones arbitraires, anchor configurable par forme, materials custom par nœud (cf. A4).

### A2. Rendu de texte — _gros mais incontournable en 2D_

- **Constat** : aucun rendu de texte aujourd'hui (uniquement sprites).
- **Objectif** : bitmap font ou MSDF, exposé comme built-in `"text"` via `getBuiltinShader` + un batch de glyphes (même mécanique que `WebGPUSpriteBatch`).
- **Fichiers** : nouveau système sous `packages/nebula/src/graphics` + `packages/nebula-webgpu` (shader glyphes, atlas), enregistrement dans `WebGPUBuiltinShaders`.
- **Portée** : grande.

### A3. Post-processing

- **Constat** : le seam `RenderPass`/`RenderTarget` (Phase 4) a été posé exprès pour ça (render-to-texture vérifié bout-en-bout).
- **Objectif** : une stack de passes post-process (bloom, vignette…) chaînées sur des `RenderTarget` offscreen. Rejoint la vision `docs/material-graph-serialization.md`.
- **Fichiers** : couche render dans `packages/nebula` (orchestration des passes), shaders post côté webgpu.
- **Portée** : moyenne/grande.

### A4. Materials custom sur les nœuds de scène

- **Constat** : le chemin générique `draw(geometry, material, bindings)` n'est utilisable qu'à la main (`apps/webgpu/src/easy-material.ts` pilote le renderer directement). Rien ne permet d'attacher un material custom à un nœud de la scène.
- **Objectif** : override de material par nœud (ex. `MaterialSprite` ou champ material sur `Sprite`), unifiant le chemin sprite instancié et le chemin material générique. Passerelle vers le material-graph.
- **Fichiers** : `packages/nebula/src/graphics/Sprite.ts`, `renderers/SpriteRenderer.ts` / `SceneRenderer.ts`, `DrawCommand`.
- **Portée** : moyenne (touche le cœur de la couche render).

---

## B. Dette / trous repérés

### B1. Cycle de vie des ressources — _le plus « dette »_

- **Constat** : plusieurs caches grossissent sans éviction : `batchIds` (`SpriteRenderer`), `WebGPUBindingGroupCache`, `WebGPUShaderCache`, `WebGPUPipelineCache`, `instancedPipelines`. Les textures/samplers/geometry ont `destroy()` mais rien ne l'appelle au teardown d'une scène/objet. Review 2026-07 confirme aussi des fuites au teardown du renderer : `defaultSampler` (`SpriteRenderer`), les `SpriteBatch`/`ShapeBatch` du `SceneRenderer` (leur `materialGroup` + buffers) et la géométrie de `createQuad` ne sont jamais `destroy()` (GC quand le device tombe, mais fuite si on recrée des renderers).
- **Objectif** : passe disposal/éviction/refcount — libérer les ressources GPU quand un nœud/une scène est détruit, borner la croissance des caches (utile pour moteur long-running, scènes dynamiques, hot-reload).
- **Fichiers** : caches sous `packages/nebula-webgpu/src/caches`, `SpriteRenderer`, cycle de vie des nœuds (`Node.removeChild`/`removeFromParent`).
- **Portée** : moyenne, transverse.

### B2. Éditeur désynchronisé de nebula — _à investiguer en premier si l'éditeur compte_

- **Constat** : `packages/editor` est écrit contre une **API nebula divergente qui ne compile pas** contre la source actuelle. Exemples relevés : `RectNode` (non exporté par nebula), `Node.position`/`Node.scale` (pas de getters aujourd'hui), `Node.parent` accédé en public (il est `private`), `camera.screenToWorldTo`/`screenToWorldInto`/`camera.rotation`/`camera.zoom` (absents de `Camera2D`).
- **Objectif** : réconcilier editor ↔ nebula (soit exposer l'API attendue côté nebula, soit adapter l'éditeur). À cadrer : quelle est l'API cible.
- **Fichiers** : `packages/editor/src/**`, `packages/nebula/src/graphics/Node.ts` + `core/camera/Camera2D.ts`.
- **Portée** : potentiellement grande (session dédiée).

### B3. Resize du canvas — **✅ fait** (voir `docs/canvas-resize-design.md`)

- **Constat** : `canvas.width`/`height` fixés une seule fois au load (dans les apps), aucun handler de resize, le `GPUCanvasContext` n'est jamais reconfiguré, la caméra lit `canvas.width` chaque frame mais rien ne suit un redimensionnement.
- **Livré** : `Renderer.resize(width, height)` (pixels logiques) ; `WebGPURenderer` tracke la taille logique à part du backing store physique (× DPR pour HiDPI, caméra en pixels logiques) ; auto-observe par défaut via `ResizeObserver` (`devicePixelContentBoxSize`, option `autoResize` désactivable) ; pas de reconfigure du contexte (le drawing buffer suit `canvas.width/height`) ; passthrough `NebulaRenderer.resize`. Render targets plein écran laissés hors scope (aucun n'existe encore).
- **Fichiers** : `packages/nebula-webgpu/src/WebGPURenderer.ts`, `packages/nebula/src/core/renderer/Renderer.ts`, `packages/nebula/src/NebulaRenderer.ts`, apps.

### B4. Depth test (limite 3D restante, volontairement différée)

- **Constat** : `RenderState.depthTest` et `PassDescriptor.depth` existent mais sont **inertes** (pas de depth attachment). Review 2026-07 : `depthTest` est même threadé dans les **clés de cache pipeline** (`WebGPURenderer.getOrCreatePipeline`, `WebGPUPipeline.createPipelineId`) alors qu'il n'a aucun effet — un caller qui met `depthTest: true` ne voit rien changer (piège silencieux).
- **Objectif** : depth texture (+ resize), `depthStencil` sur les pipelines keyé par la présence de depth, et faire remonter le `zIndex` dans le z clip-space du VS (aujourd'hui `z=0` partout). Surtout de la prépa 3D ; en 2D le tri painter's fait déjà l'ordre, interactions alpha+depth délicates.
- **Fichiers** : `WebGPURenderer` (pass + pipelines), shaders instanciés, `RenderState`/`PassDescriptor`.
- **Portée** : grande. Faible priorité tant que 2D-first.

---

## C. Quick wins (< 30 min)

- **`Transformable.getWorldPosition()`** renvoie un `worldPosition` **jamais mis à jour** → code mort ou bug latent (`packages/nebula/src/graphics/Transformable.ts`). Décider : le câbler (extraire la translation de `worldMatrix`, `m[12]`/`m[13]`) ou le supprimer. (Confirmé zéro caller — review 2026-07.)
- **`Renderer.getViewport()` mort** : déclaré sur `Renderer`, implémenté dans `WebGPURenderer`, re-exposé par `NebulaRenderer`, **jamais appelé** (confirmé zéro caller). Supprimer ou motiver.
- **`Pipeline` exporté publiquement** (`packages/nebula/src/core/pipeline` via `core/index.ts`) alors que le redesign l'a rendu **artefact interne** (retiré de `draw()`). Seul `WebGPUPipeline` l'implémente, dans le backend. Sortir du core public (ou reloger dans `nebula-webgpu`).
- **`Color.set(r, g, b, a)`** (`packages/nebula/src/utils/Color.ts`) n'a **pas** de défaut sur `a` alors que tous les `setColor`/`setTint` en ont un → incohérence d'API mineure.

---

## D. Review 2026-07-14 — bugs & pièges (`nebula` / `nebula-webgpu`)

> Passe de review sur les deux packages. Localisations vérifiées. Les 🔴 **P0** produisent un résultat faux ; les 🟠 **P1** ne cassent rien aujourd'hui mais sont des landmines (dette latente, arêtes vives). Le cœur instancié (packing stride/offset, pool par-draw sans aliasing, dirty-flags `Node`, indexation d'anim) a été audité et jugé **sain**.

### D1. Caméra — le culling ne correspond pas à la view matrix (zoom + pan) — 🔴 P0 — ✅ fait

- **Constat** : `Camera2D.update` construisait la view en `translate(-pos).scale(zoom)` (convention `Mat4` **post-multiply**) → un point monde `p` projetait en `zoom·p − pos`, donc la région visible réelle était `p ∈ [pos/zoom, (pos+size)/zoom]`. Mais `getCameraViewport` (`WebGPURenderer`) renvoie `Bound(pos, size/zoom)` : l'extent est bon, l'**origine** était décalée de `pos·(1 − 1/zoom)`. Nul en `zoom = 1` (jamais repéré, la démo tourne en zoom 1) ; en `zoom = 2, pos = (2000,0)` → culling faux de ~1000 px monde (sprites visibles cullés, hors-champ soumis).
- **Livré** : ordre inversé en `scale(zoom).translate(-pos)` dans `Camera2D.update` → view = `zoom·(p − pos)`, région `[pos, pos + size/zoom]` → `getCameraViewport` devient exact, avec sémantique intuitive (`position` = ancre monde top-left, zoom pivote dessus). Verrouillé par un test unitaire (nouveau harness vitest de `nebula`) : `packages/nebula/test/Camera2D.test.ts` (le `viewProjection` mappe la région cullée sur le cube NDC en zoom+pan). À `zoom = 1` la vue est identique à l'ancienne → aucune régression sur les apps (aucune n'utilise `setZoom`). Reste optionnel : confirmation visuelle en zoom+pan (aucune app n'exerce ce cas aujourd'hui).
- **Fichiers** : `packages/nebula/src/core/camera/Camera2D.ts` (`update`), + harness `packages/nebula/{vitest.config.ts,package.json}` et test. Cohérent avec `getCameraViewport` (`packages/nebula-webgpu/src/WebGPURenderer.ts`) et la convention `packages/math/src/Mat4.ts`.

### D2. `SpriteSheet.fromGrid` — frames hors-bornes — 🔴 P0 — ✅ fait

- **Constat** : `for (y = margin; y < texture.height; y += frameHeight + spacing)` (idem `x`) testait le coin **haut-gauche**, pas le coin bas-droit. Sur dimensions non multiples, avec `spacing`/`margin`, une dernière frame débordait de la texture → `SpriteRenderer.updateUVRect` produit `u0 + du > 1` → bord étiré (sampler `clamp-to-edge`). `fromAutoGrid` OK (division exacte).
- **Livré** : conditions de boucle corrigées en `x + frameWidth <= texture.width` / `y + frameHeight <= texture.height` → seules les frames entièrement contenues sont définies. Grilles exactes inchangées (la dernière colonne/ligne qui tombe pile est toujours incluse), seuls les cas non-divisibles/`spacing` changent. Verrouillé par `packages/nebula/test/SpriteSheet.test.ts` (texture 100×70, frame 32² → 6 frames au lieu de 12). Aucun consommateur `fromGrid` dans les apps.
- **Fichiers** : `packages/nebula/src/animations/SpriteSheet.ts` (`fromGrid`), test `packages/nebula/test/SpriteSheet.test.ts`.

### D3. `draw()` vs `drawInstancedBatch()` — `renderState` désynchronisé — 🟠 P1

- **Constat** : le chemin de scène est 100 % instancié (`SceneRenderer` → `RenderQueue.flush` → `Batchers` → `drawInstancedBatch`) ; `draw()` générique n'est utilisé que par `apps/webgpu/src/easy-material.ts`. Or `draw()` passe par `WebGPUBinder` (dédup via `WebGPURenderState`) tandis que `drawInstancedBatch` écrit **directement** sur `pass.setPipeline`/`setBindGroup` sans toucher le binder ni `ctx.renderState`. Conséquences : (1) l'optim redundant-bind (Phase 0) ne tourne **jamais** sur un vrai jeu et re-set le bind group global à chaque batch ; (2) **bug latent** : si `draw()` et `drawInstancedBatch()` cohabitent dans une passe (arrivera avec **A4**, materials custom sur nœuds), le binder skippe un `setPipeline`/`setBindGroup` nécessaire car `renderState` reflète un état que l'instancié a déjà écrasé → sortie corrompue.
- **Objectif** : router `drawInstancedBatch` par le même `WebGPUBinder` (ou au minimum écrire pipeline + bind groups dans `ctx.renderState`). L'optim s'applique alors aux scènes (global set 1×/frame). Lié à **E2**. Vérifier frame pixel-identique.
- **Fichiers** : `packages/nebula-webgpu/src/WebGPURenderer.ts` (`drawInstancedBatch`/`draw`), `bindings/WebGPUBinder.ts`, `states/WebGPURenderState.ts`.
- **Portée** : petite/moyenne (méthodes déjà présentes sur le binder).

### D4. `getInstancedStorageLayout` — layout unique partagé — 🟠 P1

- **Constat** : prend un `shader` en paramètre mais cache dans un **champ unique** au 1er appel (`binding = shader.objectDefinition.storage?.binding ?? 0`) et le renvoie ensuite pour tous les shaders instanciés, en ignorant `shader`. Marche car `sprite_instanced.wgsl` et `shape_instanced.wgsl` mettent le storage au même `@group(1) @binding(0)`. Un futur shader instancié avec un autre binding recevrait silencieusement un mauvais layout.
- **Objectif** : keyer par `storage.binding` (petite `Map`), ou fold dans le `WebGPUPipelineFactory` (**E2**) qui a déjà le shader.
- **Fichiers** : `packages/nebula-webgpu/src/WebGPURenderer.ts` (`getInstancedStorageLayout`).
- **Portée** : petite. Pas de trigger avec les 2 built-ins actuels.

### D5. Sort-key — collision `batchKey` sprite ↔ shape — 🟠 P1

- **Constat** : `SpriteRenderer.computeSortKey` = `z·65536 + batchId` (`batchId` = compteur d'alloc de texture, ordre premier-vu) ; `ShapeRenderer.computeSortKey` = `z·65536 + BATCH_IDS[blend]` (0-3). Les deux partagent les 16 bits bas dans une file triée unique → à `zIndex` égal, l'ordre painter de deux objets superposés suit l'ordre d'**allocation de batch** (premier-vu), pas l'ordre de scène ni les changements ultérieurs de z. Déterministe mais surprenant / figé au premier-vu.
- **Objectif** : au minimum documenter « même z = ordre indéfini pour matériaux/textures différents ». Sinon : sous-clé de stabilité (index de scène) pour départager à z égal, ou namespaces `batchKey` disjoints sprite/shape.
- **Fichiers** : `packages/nebula/src/renderers/{SpriteRenderer,ShapeRenderer,RenderQueue}.ts`.
- **Portée** : petite. Impact seulement sur objets superposés à `zIndex` identique.

### D6. `MaterialShaderBuilder` — parsing regex fragile — 🟠 P1

- **Constat** : split des membres du bloc `material { … }` sur `/[,\n;]/` → un type générique avec virgule (`array<f32, 4>`) est coupé au milieu. `MATERIAL_BLOCK = /material\s*\{([\s\S]*?)\}/` s'arrête au **1er `}`** (OK pour une liste plate, KO dès qu'un type imbrique une accolade). Chemin « easy » à surface volontairement réduite.
- **Objectif** : border avant d'ouvrir les types composés — split respectant `<…>`, ou tokenizer léger ; à défaut, garde-fou + message d'erreur explicite sur types non supportés.
- **Fichiers** : `packages/nebula-webgpu/src/authoring/MaterialShaderBuilder.ts`.
- **Portée** : petite.

### D7. `NebulaRenderer.createMaterial` drope le `renderState` — 🟠 P1

- **Constat** : `Renderer.createMaterial(shader, renderState?)` accepte un état de rendu, mais la façade `NebulaRenderer.createMaterial(shader)` délègue **sans** le transmettre → impossible de créer un matériau non-`DEFAULT_RENDER_STATE` via la façade. (Les autres `create*` de `NebulaRenderer` sont des pass-through purs.)
- **Objectif** : propager `renderState?` (et statuer : la façade doit-elle exister, ou les callers utilisent-ils `renderer` directement ?).
- **Fichiers** : `packages/nebula/src/NebulaRenderer.ts`.
- **Portée** : petite.

---

## E. Review 2026-07-14 — refactors structurels (P2)

> Extractions / unifications à fort levier. Pas de bug live, mais coût de changement élevé (et à contre-courant de la philo plugin/extensible pour E3). Chacun prendra son propre plan au moment du fix — pas de rewrite en un coup.

### E1. `WebGPURenderer` god-object (779 l.)

- **Constat** : une classe porte ~8 responsabilités qui évoluent séparément : device/context lifecycle, **canvas + resize HiDPI** (~90 l. cohérentes), frame lifecycle, **build + cache pipelines** (2 chemins, cf. E2), frame globals (camera/clock/uniform), `ResourceFactory` (14 `create*`), draw générique + `bind*`, draw instancié + culling.
- **Objectif** : extractions incrémentales, chacune shippable seule. En premier **`WebGPUSurface`** (canvas, format, `logicalWidth/Height`, `ResizeObserver`, DPR, `resize`/`applyResize`/`onResizeEntries`) — sortie propre sans couplage. Puis **`WebGPUPipelineFactory`** (E2). Puis, optionnel, **`WebGPUFrameGlobals`** (`globalBindings` + `clock` + `updateCamera`/`updateTime`).
- **Fichiers** : `packages/nebula-webgpu/src/WebGPURenderer.ts` → nouveaux `WebGPUSurface`, `WebGPUPipelineFactory`, (`WebGPUFrameGlobals`).
- **Portée** : moyenne, incrémentale.

### E2. Deux systèmes de pipeline en parallèle + clé calculée 2×

- **Constat** : chemin **indexé** (`getOrCreatePipeline`/`buildPipeline` → `WebGPUPipeline` + `WebGPUPipelineCache`) et chemin **instancié** (`getInstancedPipeline` → `GPURenderPipeline` brut dans une `Map` maison `instancedPipelines`, clé au format différent, bloc `fragment`/`blend`/`cull` dupliqué de `WebGPUPipeline`). De plus la clé de cache indexée est assemblée inline dans `WebGPURenderer` **et** recalculée dans `WebGPUPipeline.createPipelineId()` → deux sources pour la même clé, dérive silencieuse possible (collision ou miss permanent).
- **Objectif** : un `WebGPUPipelineFactory` autorité unique pour les deux variantes (`variant` indexé / instancié = sans vertex buffer + storage layout) ; clé calculée **une seule fois** (`WebGPUPipeline.computeId(...)` statique, réutilisée comme `id` ET clé de cache). Absorbe **D4**. Débloque l'amincissement **E1**, lié à **D3**.
- **Fichiers** : `packages/nebula-webgpu/src/WebGPURenderer.ts`, `pipeline/WebGPUPipeline.ts`, `caches/WebGPUPipelineCache.ts`.
- **Portée** : moyenne. Plus fort levier structurel.

### E3. Dispatch de node câblé à 6 endroits + duplication renderers

- **Constat** : ajouter un kind (texte **A2**, particules) impose d'éditer 6 sites hardcodés à 2 kinds : l'union `DrawCommand`, le `instanceof` de `SceneRenderer.collect`, la construction des batchers, le `if/else` de `RenderQueue.flush`, les deux `Batcher` structurellement identiques, et `SpriteRenderer`/`ShapeRenderer` qui dupliquent `RENDER_STATES` (octet pour octet), les constantes de z-packing, `computeSortKey` et le pattern `getOrCreateRenderData` (WeakMap).
- **Objectif** : seam `NodeRenderer { matches(node); buildCommand(node) }` + registre `Map<kind, Batcher>` dans `RenderQueue` + `NodeRendererBase` partagé (RENDER_STATES, z-packing, cache). **Garder `DrawCommand` concret** (les batchers ont besoin des champs typés) — le seam va au *dispatch*, pas à la donnée. À faire **avant A2**.
- **Fichiers** : `packages/nebula/src/renderers/{SceneRenderer,RenderQueue,Batchers,SpriteRenderer,ShapeRenderer,DrawCommand}.ts`.
- **Portée** : moyenne.

---

## Ordre conseillé

Worklist priorisée (review 2026-07 fondue). 🔴 P0 (bugs) d'abord, puis 🟠 P1 + refactors E par levier, puis suites/dette existantes.

1. ~~**D1 — bug caméra zoom+pan**~~ ✅ fait (test `packages/nebula/test/Camera2D.test.ts`).
2. ~~**D2 — `fromGrid` hors-bornes**~~ ✅ fait (test `packages/nebula/test/SpriteSheet.test.ts`).
3. **C — quick wins** (`getWorldPosition`, `getViewport` mort, export `Pipeline`, `Color.set`).
4. **D7 — `createMaterial` renderState** (trivial).
5. **D3 — unifier l'instancié via `WebGPUBinder`** 🟠 (supprime optim morte + bug latent, prépare E).
6. **E2 — `WebGPUPipelineFactory` + clé unique** (absorbe D4 ; plus fort levier).
7. **E1 — split `WebGPURenderer`** (`WebGPUSurface` d'abord, puis fold E2, puis `WebGPUFrameGlobals`).
8. **E3 — seam `NodeRenderer` + dédup renderers** — **avant A2**.
9. **D5 / D6** — sort-key (doc/fix), `MaterialShaderBuilder` — au fil de l'eau.
10. **A2 — texte** (se branche comme batcher sur le seam E3).
11. **B1 — cycle de vie des ressources** (dès scènes dynamiques / avant l'éditeur).
12. **B2 — éditeur** (session dédiée, si cible).
13. Le reste (A3/A4) au fil de l'eau ; **B4 (depth)** seulement si la 3D redevient prioritaire. (~~A1 formes~~, ~~B3 resize~~ ✅ faits.)
