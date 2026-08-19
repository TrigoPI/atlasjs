---
id: RENDER-05
legacyId: B4
status: todo
domain: rendering
source: "[[renderer-architecture]]"
effort: L
verified: 2026-08-19
---

# Depth test 3D

`RenderState.depthTest` et `PassDescriptor.depth` existent et entrent dans la clé de cache pipeline, mais restent totalement inertes : aucun `GPUDepthStencilState` n'est jamais créé dans `createRenderPipeline`, aucune texture de depth n'est allouée, et `zIndex` n'est jamais projeté en z clip-space.

**Accroche :** `RenderState.depthTest` (`packages/nebula/src/core/core-types.ts:41`) et la clé de cache pipeline (`WebGPUPipeline.computeKey`) portent déjà l'information ; il manque le branchement vers `createRenderPipeline` dans `packages/nebula-webgpu/src/pipeline/WebGPUPipeline.ts`.
