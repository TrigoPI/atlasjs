---
id: RENDER-22
status: todo
domain: rendering
source: "[[trails]]"
effort: S
verified: 2026-08-23
---

# Faire décroître le pool de buffers d'instances

`WebGPUInstanceBufferPool.slots` ne rétrécit jamais : le nombre de `GPUBuffer` alloués monte au high-water mark des draws instanciés d'une frame et y reste, à 1 Ko minimum chacun. Comportement préexistant, mais les trails sont la première feature capable d'atteindre des dizaines de draws instanciés simultanés — sur un layer `ySorted` les trails s'intercalent avec les sprites et ne fusionnent quasi jamais, donc 50 projectiles à trail valent 50 buffers permanents.

**Accroche :** `reset()` remet déjà l'index à zéro à chaque frame dans `packages/nebula-webgpu/src/batch/WebGPUInstanceBufferPool.ts` — c'est l'endroit qui connaît le high-water mark et pourrait libérer les slots restés inutilisés plusieurs frames d'affilée.
