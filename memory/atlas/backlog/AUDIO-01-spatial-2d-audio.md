---
id: AUDIO-01
status: todo
domain: audio
source: "[[audio]]"
effort: L
verified: 2026-08-19
---

# Audio spatial 2D (pan, atténuation, `AudioListener`)

Le moteur audio ne fait aucune spatialisation : ni pan ni atténuation par distance, aucun `PannerNode` Web Audio, aucun concept d'`AudioListener`. Toutes les sources sonnent identiques quelle que soit la position de l'entité par rapport à la caméra ou au joueur.

**Accroche :** `AudioSource` (`packages/gameplay/src/components/AudioSource.ts`) est déjà pensé forward-compat pour lire une position via `Transform2D` sans remettre en cause son modèle de données actuel.
