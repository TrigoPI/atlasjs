---
id: RENDER-06
status: todo
domain: rendering
source: "[[renderer-architecture]]"
effort: M
verified: 2026-08-19
---

# Extraction ResourceFactory de WebGPURenderer

Les 13 méthodes `create*` (`createQuad`, `createUniformBuffer`, `createSampler`, `createShader`, `createVertexBuffer`, `createIndexBuffer`, `createBindingGroup`, `createMaterial`, `createSpriteBatch`, `createShapeBatch`, `createGeometry`, `createTexture2D`, `createRenderTarget`) vivent toujours directement sur `WebGPURenderer` (526 lignes) : il reste à les extraire dans une classe `ResourceFactory` séparée côté backend, sur le modèle des extractions déjà faites (`WebGPUSurface`, `WebGPUFrameGlobals`).

**Accroche :** `packages/nebula-webgpu/src/surface/WebGPUSurface.ts` et `packages/nebula-webgpu/src/frame/WebGPUFrameGlobals.ts` donnent le patron d'extraction déjà appliqué deux fois sur ce même fichier.
