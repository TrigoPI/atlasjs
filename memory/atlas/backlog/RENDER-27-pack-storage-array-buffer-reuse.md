---
id: RENDER-27
status: todo
domain: rendering
source: "[[particles]]"
effort: S
verified: 2026-09-04
---

# Réutiliser le buffer de `packStorageArray`

`BindingGroupLayoutHelper.packStorageArray` alloue un `new ArrayBuffer(stride * count)` neuf **à chaque appel** (`packages/nebula/src/core/utils/BindingGroupLayoutHelper.ts:34`), et l'appel a lieu une fois par batch instancié par frame : `WebGPUInstancedBatch.pack()` (`packages/nebula-webgpu/src/batch/WebGPUInstancedBatch.ts:61`) est invoqué depuis `WebGPURenderer.ts:394` sur le chemin de draw. À 5 000 particules × 96 octets cela fait 480 ko par frame, soit ~29 Mo/s de déchets. C'est **le coût le plus lourd du chemin particules** et la première optimisation à tenter, avant tout travail GPU.

**Accroche :** la fonction reçoit déjà `stride` et `count`, donc un buffer gardé au high-water mark sur le batch suffit ; `WebGPUInstanceBufferPool.getSlot` fait déjà exactement ce grow-and-keep côté GPU (`packages/nebula-webgpu/src/batch/WebGPUInstanceBufferPool.ts:47-78`, capacité doublée et conservée).

Noter que le problème touche **tous** les batchs instanciés, pas seulement les particules : `WebGPUSpriteBatch`, `WebGPUShapeBatch` et `WebGPUTrailBatch` héritent tous du `pack()` de `WebGPUInstancedBatch`. `trails.md` §7 signalait déjà la dette comme préexistante et partagée ; les particules la rendent simplement mesurable.
