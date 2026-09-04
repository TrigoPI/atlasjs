---
id: GAMEPLAY-115
status: todo
domain: gameplay
source: "[[particles]]"
effort: M
verified: 2026-09-04
---

# Attracteurs et champs de forces

Des forces ponctuelles et directionnelles auxquelles un nuage réagit, déclarées en données pour pouvoir être pilotées par le gameplay — un vortex sur une capacité, un vent qui tourne, une aspiration vers un point de collecte.

**Accroche :** le même site d'addend que le bruit, dans `CPUParticleNode.integrate` (`packages/nebula/src/graphics/CPUParticleNode.ts:630-637`) : les forces s'accumulent dans `accelerationX`/`accelerationY` avant l'intégration, aux côtés de la gravité et de `velocityOverLifetime`.

Vaut d'être consigné : c'est la classe de feature que la simulation CPU rend triviale et qu'une simulation GPU rend difficile, puisqu'il faudrait alors faire parvenir les forces au passage de compute au lieu de les lire directement sur l'ECS — voir [[RENDER-31-gpu-particle-simulation]].
