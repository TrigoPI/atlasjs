---
id: AUDIO-03
status: todo
domain: audio
source: "[[audio]]"
effort: M
verified: 2026-08-19
---

# Bus de mixage + ducking

`AudioEngine` ne connaît qu'un seul `GainNode` master (`packages/audio/src/AudioEngine.ts`) : toutes les voix, sfx ou musique, partagent le même volume global. Il manque des bus intermédiaires (master → sfx / music / ui) et un ducking automatique (par exemple baisser la musique pendant un dialogue).

**Accroche :** le `master` `GainNode` déjà câblé dans `AudioEngine` donne le point d'insertion pour des bus intermédiaires entre les voix et lui.
