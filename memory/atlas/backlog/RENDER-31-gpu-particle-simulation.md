---
id: RENDER-31
status: vision
domain: rendering
source: "[[particles]]"
effort: L
verified: 2026-09-04
---

# Simulation de particules sur GPU

Déplacer la simulation dans un compute shader. Les verrous sont concrets et aucun n'est levé aujourd'hui :

1. **Aucune abstraction de pipeline de compute** dans `nebula` ni `nebula-webgpu` — zéro `@compute`, zéro `dispatchWorkgroups`, zéro `createComputePipeline` sous `src/`. Tout le `PipelineFactory` est écrit pour du render.
2. `WebGPUPipelineFactory.getStorageLayout` code en dur `visibility: GPUShaderStage.VERTEX` et `buffer: { type: "read-only-storage" }` (`packages/nebula-webgpu/src/pipeline/WebGPUPipelineFactory.ts:128-147`), et le layout est mémoïsé par numéro de binding — un buffer accessible en écriture depuis le compute demanderait une deuxième famille de layouts.
3. `WebGPUInstanceBufferPool` est un pool de scratch **par frame**, remis à zéro dans `beginFrame` (`packages/nebula-webgpu/src/WebGPURenderer.ts:300` et `:333`), pas un état persistant. Une simulation GPU a besoin de buffers qui survivent d'une frame à l'autre.
4. **Pas de draw indirect** : aucun `drawIndirect`/`drawIndexedIndirect` dans le backend, donc le nombre d'instances resterait à décider côté CPU.

Cela sacrifie aussi la **lisibilité CPU** des particules, qui est précisément ce qui rend la collision, les attracteurs et les sous-émetteurs peu coûteux à écrire.

**Accroche :** le descripteur d'émetteur est déjà un POJO sérialisable pur, avec des easings **nommés** (`EasingName`, résolus par le `easingValue` privé de `CPUParticleNode.ts:43-58`) plutôt que des fonctions, précisément pour qu'un backend GPU puisse consommer le même objet sans changement — le modèle de données n'a aucune migration à subir, seul le pipeline en a une.

Le gain ne commence qu'au-delà de ~50 000 particules ; en dessous, [[RENDER-27-pack-storage-array-buffer-reuse]] et [[RENDER-26-particle-lean-instance-struct]] rapportent davantage pour bien moins de travail.
