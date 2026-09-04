---
id: RENDER-26
status: todo
domain: rendering
source: "[[particles]]"
effort: M
verified: 2026-09-04
---

# Struct d'instance dédié aux particules

Les particules passent par le batch de sprites, donc par le `struct Instance { model: mat4x4<f32>, uvRect: vec4<f32>, tint: vec4<f32> }` de `packages/nebula-webgpu/src/shaders/sprite_instanced.wgsl:1-5` — **96 octets par particule**, dont 64 pour une matrice qui n'encode qu'une translation, une rotation Z et une échelle uniforme. Un `particle_instanced.wgsl` portant `pos`, `size`, `rotation`, `uvRect` et `tint`, avec le quad et la matrice de rotation construits dans le vertex shader, supprime à la fois la composition CPU d'un `Mat4` par particule et les deux appels trigonométriques par particule par frame.

Écarté délibérément parce que cela abandonne la propriété « zéro changement de backend » du design actuel : il faut un nouveau fichier WGSL, une classe `WebGPU*Batch` (aux côtés de `WebGPUSpriteBatch`/`WebGPUShapeBatch`/`WebGPUTrailBatch`), une méthode sur `ResourceFactory` à côté de `createSpriteBatch()`, et une entrée dans le `WebGPUBuiltinShaders` de `packages/nebula-webgpu/src/resources/WebGPUShaderList.ts:44`.

**Accroche :** `CPUParticleNodeRenderer.updateInstances` fait aujourd'hui `model.copy(base).translate(node.getX(i), node.getY(i), 0).rotateZ(rotation).scale(size, size)` par particule (`packages/nebula/src/renderers/CPUParticleNodeRenderer.ts:193-197`), et `Mat4.rotateZ` recalcule un `Math.sin` et un `Math.cos` à chaque appel (`packages/math/src/Mat4.ts:101-102`) ; `sprite_instanced.wgsl` prouve déjà le patron de vertex pulling que celui-ci suivrait (positions et UV en `array<vec2<f32>, 6>` constant, `@builtin(vertex_index)`).

**Le gain réel n'est pas 48 octets par une liste de champs naïve.** Sous les règles d'alignement WGSL (`vec4<f32>` aligné sur 16), `{ pos: vec2, size: vec2, rotation: f32, uvRect: vec4, tint: vec4 }` retombe à **64 octets** (12 octets de padding après `rotation`, `uvRect` à l'offset 32). Atteindre 48 demande de grouper explicitement : `posSize: vec4<f32>` à 0, `uvRect: vec4<f32>` à 16, `rotation: f32` à 32 et un `tint` packé en `u32` (unorm8x4) à 36. À décider au moment de l'écriture : 96 → 64 sans rien packer, 96 → 48 en packant la teinte.
