---
id: AUDIO-05
status: todo
domain: audio
source: "[[audio]]"
effort: S
verified: 2026-08-19
---

# Pooling de voix / cap de concurrence

`AudioEngine.createVoice` crée un nouveau `AudioBufferSourceNode` + `GainNode` à chaque appel, sans limite ni réutilisation : chaque son concurrent alloue sa propre paire de nodes indéfiniment. Il manque un pool ou un plafond de voix concurrentes.
