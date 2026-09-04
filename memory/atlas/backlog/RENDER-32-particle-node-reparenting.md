---
id: RENDER-32
status: todo
domain: rendering
source: "[[particles]]"
effort: S
verified: 2026-09-04
---

# Un `CPUParticleNode` reparenté baked une matrice parente identité

`ParticleEmitterSystem` appelle `node.updateWorldMatrix()` lui-même avant `advance` (`packages/gameplay/src/systems/ParticleEmitterSystem.ts:92-96`), parce que le nœud baked la position monde d'une particule à la naissance en `simulationSpace: "world"` (`CPUParticleNode.spawnOne`, `packages/nebula/src/graphics/CPUParticleNode.ts:700-706`) alors que `SceneGraph` ne met à jour les matrices monde que plus tard dans la frame. Ce pré-passage est appelé **sans matrice parente**, et il remet `localDirty` à `false` (`packages/nebula/src/graphics/Node.ts:104-118`) : si un `CPUParticleNode` était un jour reparenté sous un nœud de transform non identité, le pré-passage baked un parent identité **et** ferait sauter le recalcul au passage de `SceneGraph` (parent propre → enfant propre).

**Accroche :** le système parente toujours via `nebula.scene.addChild(node)` (`ParticleEmitterSystem.ts:141`), donc l'invariant tient aujourd'hui ; le correctif est soit de passer la vraie matrice parente — la signature `updateWorldMatrix(parentWorld?, parentChanged?)` l'accepte déjà — soit de laisser `localDirty` tranquille dans ce pré-passage.
