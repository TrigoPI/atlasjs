---
id: GAMEPLAY-05
status: vision
domain: gameplay
source: "[[sprite-animation]]"
effort: L
verified: 2026-08-19
---

# Root motion depuis l'animation

Aucun mécanisme n'extrait de déplacement depuis un clip d'animation vers la transform de l'entité — ni dans `AnimationPlayer`/`SpriteAnimation`/`Animator`, ni dans `PhysicsPushSystem`/`PhysicsPullSystem`. Il reste à concevoir ce couplage anim → transform (et son interaction avec l'autorité physique déclarée par type de corps), sujet qui reste entièrement à défricher côté conception.
