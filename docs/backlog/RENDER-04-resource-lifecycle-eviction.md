---
id: RENDER-04
legacyId: B1
status: partial
domain: rendering
source: "[[renderer-architecture]]"
effort: M
verified: 2026-08-19
---

# Resource lifecycle / eviction

Le teardown du backend est bien câblé (`NebulaPlugin.uninstall()` → `WebGPURenderer.destroy()`), mais deux manques subsistent : aucune éviction en cours de run (les caches — `WebGPUShaderCache`, `WebGPUBindingGroupCache`, `WebGPUPipelineFactory.pipelines` — sont de simples `Map`/`WeakMap` sans LRU ni refcount), et `NebulaRenderer`/`SceneRenderer`/`SpriteRenderer`/`TileMapNodeRenderer` n'ont aucune méthode `destroy()`, ce qui fuit leurs ressources (`defaultSampler`, `batchIds`) en cas de réinstallation du plugin.

**Accroche :** `WebGPURenderer.destroy()` (`packages/nebula-webgpu/src/WebGPURenderer.ts:102-108`) donne déjà le patron à suivre pour les `destroy()` manquants côté `nebula`.
