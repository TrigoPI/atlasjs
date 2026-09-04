---
id: GAMEPLAY-119
status: todo
domain: gameplay
source: "[[particles]]"
effort: S
verified: 2026-09-04
---

# Regrainer un émetteur vivant

`CPUParticleNode.applyConfig` saute délibérément `seed` (`packages/nebula/src/graphics/CPUParticleNode.ts:195-240` — aucune ligne ne le lit) : le `rng` est graine dans le constructeur (`:182-185`) et regrainer un émetteur en vol ferait sauter son flux aléatoire en cours de route. Un `setConfig` porteur d'un nouveau `seed` est donc **silencieusement ignoré** — `ParticleEmitterSystem` appelle `node.applyConfig(emitter.config)` dès que la référence de config change (`packages/gameplay/src/systems/ParticleEmitterSystem.ts:71-74`) — et un regrainage déterministe demande aujourd'hui de construire un nouveau nœud.

**Accroche :** `rng` est un champ privé qui tient la fermeture renvoyée par le `mulberry32` privé au module (`CPUParticleNode.ts:31-41`), ou `Math.random` si aucune graine finie n'est fournie. La décision à prendre est de savoir si un regrainage doit aussi remettre à zéro les particules vivantes — c'est pourquoi il n'a pas simplement été exposé en setter.
