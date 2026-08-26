---
id: RENDER-07
status: todo
domain: rendering
source: "[[renderer-architecture]]"
effort: S
verified: 2026-08-19
---

# Canal `topology` dans PipelineKeySpec

`topology` est codé en dur à `"triangle-list"` dans `getIndexed`/`getInstanced` (`packages/nebula-webgpu/src/pipeline/WebGPUPipelineFactory.ts:30,82`), alors que `Primitive` déclare déjà `point-list`/`line-list`/`line-strip`/`triangle-strip`. Le canal existe dans la clé de cache mais aucun appelant ne le fait jamais varier : il faut le brancher sur une vraie valeur de `Primitive`.

**Accroche :** `Primitive` (`packages/nebula/src/core/core-types.ts:23-27`) déclare déjà les valeurs de topologie attendues ; il ne reste qu'à les faire remonter jusqu'à `getIndexed`/`getInstanced`.
