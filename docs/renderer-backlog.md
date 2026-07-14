# Nebula — Backlog / Pistes de travail

> Statut : **backlog** (candidats non planifiés, pas de design validé)
> Portée : `@atlasjs/nebula` (+ `@atlasjs/nebula-webgpu`, `@atlasjs/editor`)
> Contexte : le refactor renderer est terminé (voir `docs/renderer-architecture-redesign.md`, 6 phases + dirty-flag + tint/blend par sprite tous faits). Ce doc liste les suites naturelles et la dette repérée pendant ce refactor, pour reprise directe.

Ordre conseillé en bas du doc.

---

## A. Suites naturelles du renderer (bâtissent sur l'archi en place)

### A1. Rendu de formes / primitives — _reco n°1, meilleur ratio valeur/effort_

- **Constat** : `Shape` et `Rect` existent comme nœuds et `Shape.color` est déclaré, mais `SceneRenderer` ne dessine **que** les `Sprite` (`drawNode`/`collect` filtrent `node instanceof Sprite`). Rects/formes/lignes ne s'affichent pas ; `Shape.color` est inutilisé.
- **Objectif** : un rendu de quads colorés (puis lignes/cercles) via un batch dédié ou le chemin material générique. Réutilise l'infra batch instancié + shader library posées au refactor.
- **Fichiers** : `packages/nebula/src/graphics/Shape.ts`, `Rect.ts`, `packages/nebula/src/renderers/SceneRenderer.ts` (dispatch par type de nœud), + un shader/batch built-in côté webgpu.
- **Portée** : moyenne. Bien cadré.

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

- **Constat** : plusieurs caches grossissent sans éviction : `materialCache` + `batchIds` (`SpriteRenderer`), `WebGPUBindingGroupCache`, `WebGPUShaderCache`, `WebGPUPipelineCache`, `instancedPipelines`. Les textures/samplers/geometry ont `destroy()` mais rien ne l'appelle au teardown d'une scène/objet.
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

- **Constat** : `RenderState.depthTest` et `PassDescriptor.depth` existent mais sont **inertes** (pas de depth attachment).
- **Objectif** : depth texture (+ resize), `depthStencil` sur les pipelines keyé par la présence de depth, et faire remonter le `zIndex` dans le z clip-space du VS (aujourd'hui `z=0` partout). Surtout de la prépa 3D ; en 2D le tri painter's fait déjà l'ordre, interactions alpha+depth délicates.
- **Fichiers** : `WebGPURenderer` (pass + pipelines), shaders instanciés, `RenderState`/`PassDescriptor`.
- **Portée** : grande. Faible priorité tant que 2D-first.

---

## C. Quick wins (< 30 min)

- **`Transformable.getWorldPosition()`** renvoie un `worldPosition` **jamais mis à jour** → code mort ou bug latent (`packages/nebula/src/graphics/Transformable.ts`). Décider : le câbler (extraire la translation de `worldMatrix`) ou le supprimer.
- **Erreurs de type pré-existantes** dans `apps/webgpu/src/ecs.ts` (API Nexus `Component`/`world`) — non liées au renderer, mais elles polluent le typecheck de l'app.

---

## Ordre conseillé

1. **A1 — formes/primitives** (cadré, comble un trou 2D évident, réutilise le batch).
2. **A2 — texte** (gros morceau, l'archi est prête).
3. **B1 — cycle de vie des ressources** (à traiter dès que les scènes deviennent dynamiques / avant l'éditeur).
4. **B2 — éditeur** (session dédiée, si l'éditeur est une cible).
5. Le reste (A3/A4/C) au fil de l'eau ; **B4 (depth)** seulement si la 3D redevient prioritaire. (~~B3 resize~~ ✅ fait.)
