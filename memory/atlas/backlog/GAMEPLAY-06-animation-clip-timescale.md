---
id: GAMEPLAY-06
status: todo
domain: gameplay
source: "[[sprite-animation]]"
effort: S
verified: 2026-08-19
---

# Vitesse / timescale par clip d'animation

`SpriteAnimation` n'a pas de champ `timescale`/`speed` : la durée de frame est dérivée uniquement du `fps` du clip. Il reste à ajouter un facteur multiplicatif appliqué au `deltaMs` avant `tick()`, pour permettre de ralentir ou accélérer un clip donné sans changer son `fps` de base.

**Accroche :** `SpriteAnimation` (`packages/nebula/src/animations/SpriteAnimation.ts:6-30`) est le point d'entrée : il s'agit d'un facteur appliqué avant l'appel à `tick()`, pas d'une nouvelle mécanique de lecture.
