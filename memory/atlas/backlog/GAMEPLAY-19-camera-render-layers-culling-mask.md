---
id: GAMEPLAY-19
legacyId: C4
status: todo
domain: gameplay
source: "[[camera]]"
effort: M
verified: 2026-08-19
---

# Couches de rendu / culling mask par caméra

`Camera` n'a toujours qu'un champ `zoom`, et `SceneRenderer.collect()` ne filtre par aucune notion de layer ou de caméra. Reste à introduire un culling mask par caméra pour distinguer par exemple UI et monde.

**Bloqué par :** [[GAMEPLAY-16-multi-camera-render]] — filtrer par caméra suppose plusieurs caméras rendues à arbitrer.
