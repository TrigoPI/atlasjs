---
id: APP-03
status: todo
domain: app
effort: S
verified: 2026-08-21
---

# `RunningParticleSpawnerScript.clock` non initialisé

`clock` est déclaré sans valeur et `onCreate` ne l'initialise pas (`apps/dino-brawl/src/game/scripts/player/RunningParticleSpawnerScript.ts`), donc `this.clock += dt` vaut `NaN` : les particules ne partent que parce que la branche `v.mag() === 0` remet le compteur à 0 au premier frame à l'arrêt. Le jeu démarre immobile, le bug est donc masqué.

**Accroche :** `RunningAudioPlayerScript` fait exactement le même travail (horloge, cooldown marche/course, `instantiate`) et initialise bien son `clock` — les deux scripts sont candidats à une fusion en un seul émetteur périodique, qui règlerait le problème par construction.
