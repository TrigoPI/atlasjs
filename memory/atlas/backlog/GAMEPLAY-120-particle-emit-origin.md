---
id: GAMEPLAY-120
status: todo
domain: gameplay
source: "[[collision-contacts]]"
effort: M
verified: 2026-09-05
---

# Émettre des particules ailleurs qu'au transform de l'entité porteuse

Un `emitAt(count, x, y)`, ou un décalage d'origine dans `ParticleEmitterConfig` : c'est la vraie
réponse moteur à « jouer des particules à un point arbitraire ». Le besoin est constaté, pas déduit —
le point de contact des collisions est livré ([[collision-contacts]]) et `apps/bump-royal` doit le
contourner par une **entité enfant repositionnée avant chaque émission**
(`apps/bump-royal/src/game/script/player/PlayerCollisionScript.ts`, `placeDust`), une entité et un
recalage d'offset local par choc pour ce qui devrait être un argument.

**Accroche :** `ParticleEmitter.emit(count)`
(`packages/gameplay/src/components/ParticleEmitter.ts:61`) valide le compte puis ne fait
qu'incrémenter `pendingEmit` — c'est `ParticleEmitterSystem` qui le draine plus tard et spawne au
transform de l'entité ; et `ParticleEmitterConfig`
(`packages/nebula/src/graphics/particle-types.ts:66-90`) n'a **ni `offset` ni `origin`**, sa seule
géométrie d'émission étant `shape`. Le point à trancher avant d'écrire quoi que ce soit est
l'interaction avec `simulationSpace: "local"` (une origine monde n'y a pas le même sens qu'en
`"world"`), avec `shape` (l'origine décale-t-elle la forme, ou remplace-t-elle son centre ?) et avec
le prewarm. Le caractère **différé** de `emit` est la contrainte structurante : `pendingEmit` est un
simple compteur cumulatif, donc une origine par appel demande de porter la position **avec** le
compte, pas à côté.
