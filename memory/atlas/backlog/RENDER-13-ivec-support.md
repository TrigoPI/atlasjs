---
id: RENDER-13
status: todo
domain: rendering
source: "[[shaders-materials]]"
effort: S
verified: 2026-08-19
---

# Support `ivec*`/`uvec*` (vecteurs d'entiers)

`packages/math/src` ne contient aucune classe `IVec2`/`IVec3`/`IVec4` (seulement `Vec2`/`Vec3`/`Vec4`), et `WebGPUReflection` gère `i32` scalaire mais aucun cas `vec*<i32>`/`vec*<u32>`. Il faudrait ajouter les types math correspondants et les cas de mapping manquants côté réflexion. Le doc source signale lui-même qu'aucun besoin concret n'est identifié à ce jour — utile pour qui priorise cet item.

**Accroche :** le mapping de types WGSL→JS existe déjà pour les scalaires et les vecteurs flottants dans `WebGPUReflection` ; il ne reste qu'à étendre le même mécanisme aux variantes entières.
