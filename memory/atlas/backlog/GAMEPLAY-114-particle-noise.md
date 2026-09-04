---
id: GAMEPLAY-114
status: todo
domain: gameplay
source: "[[particles]]"
effort: M
verified: 2026-09-04
---

# Bruit et turbulence sur la vélocité des particules

Un offset de value noise peu coûteux appliqué à la vélocité — c'est ce qui fait lire une fumée ou un feu comme vivants plutôt que comme un jet radial. Rien de tel dans le v1 : une particule suit une trajectoire parfaitement lisse entre sa naissance et sa mort.

**Accroche :** `CPUParticleNode.integrate` applique déjà la gravité et une rampe d'accélération `velocityOverLifetime` par particule dans la même boucle (`packages/nebula/src/graphics/CPUParticleNode.ts:619-657`, `accelerationX`/`accelerationY` accumulés avant l'intégration) ; un terme de bruit est un addend de plus au même endroit, et le `rng` graine du nœud est déjà là pour la reproductibilité.
