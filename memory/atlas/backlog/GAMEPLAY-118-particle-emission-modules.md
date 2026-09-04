---
id: GAMEPLAY-118
status: todo
domain: gameplay
source: "[[particles]]"
effort: M
verified: 2026-09-04
---

# Modules d'émission et de vélocité restants

Les modules Unity laissés hors du v1 : `emitOverDistance` (émettre par unité parcourue plutôt que par seconde — la poussière sous des pieds qui courent, qui doit s'arrêter quand le personnage s'arrête), `inheritVelocity` (une fraction de la vélocité de l'émetteur ajoutée à la naissance) et `limitVelocity` (un clamp de vitesse sur la durée de vie).

**Accroche :** `ParticleEmitterSystem` suit déjà le transform monde de l'émetteur à chaque frame (`packages/gameplay/src/systems/ParticleEmitterSystem.ts:84-90`) et vide un `pendingEmit` cumulatif avec report fractionnaire (`ParticleEmitterSystem.drain`, `:175-181` — `Math.floor` émis, reste conservé), qui est exactement l'accumulateur dont `emitOverDistance` a besoin ; le même patron de report existe côté nœud dans `CPUParticleNode.runRate` (`:568-585`). Pour le seuil de distance, la porte au carré est déjà écrite : le champ vit sur le composant (`AfterimageRenderer.minDistance`, `packages/gameplay/src/components/AfterimageRenderer.ts:20`) et le test `dx * dx + dy * dy < minDistance * minDistance` dans le système (`packages/gameplay/src/systems/AfterimageRenderSystem.ts:194-196`).
