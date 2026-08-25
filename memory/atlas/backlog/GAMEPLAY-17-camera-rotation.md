---
id: GAMEPLAY-17
legacyId: C2
status: todo
domain: gameplay
source: "[[camera]]"
effort: M
verified: 2026-08-19
---

# Rotation de caméra

`Camera2D.view` (`packages/nebula/src/core/camera/Camera2D.ts:55-58`) ne compose que `scale().translate()`, sans terme de rotation. Introduire une rotation exige de revoir `screenToWorld`/`worldToScreen`, aujourd'hui un modèle analytique qui s'annule justement parce qu'il n'y a pas de rotation, vers un `Mat4.invert` général.
