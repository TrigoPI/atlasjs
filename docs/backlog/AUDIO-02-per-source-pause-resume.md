---
id: AUDIO-02
status: todo
domain: audio
source: "[[audio]]"
effort: M
verified: 2026-08-19
---

# Pause/resume par source

`Voice` (`packages/audio/src/Voice.ts`) ne propose que `stop()` : aucune pause/resume ciblée par source n'existe, seul un suspend global de tout l'`AudioContext` (`AudioEngine.handleVisibility`, déclenché par le `visibilitychange` de l'onglet). Une pause par voix demande de tracker un offset de lecture et de recréer l'`AudioBufferSourceNode` sous-jacent, ce type de node ne se pausant pas nativement côté Web Audio.

**Accroche :** `Voice` détient déjà `source`/`gain` en privé — la pause peut se brancher sur cette même classe plutôt que d'en créer une nouvelle.
