---
id: GAMEPLAY-21
legacyId: C6
status: vision
domain: gameplay
source: "[[camera]]"
effort: L
verified: 2026-08-19
---

# Projection non-ortho (perspective)

L'interface `Camera` (`packages/nebula/src/core/camera/Camera.ts:3-6`, `{ viewProjection: Mat4; update(w, h) }`) est déjà assez générique pour porter une projection perspective, mais `Camera2D` reste la seule implémentation concrète et elle est ortho. Ouvrir une caméra perspective reste une vision 3D entière, non conçue.
