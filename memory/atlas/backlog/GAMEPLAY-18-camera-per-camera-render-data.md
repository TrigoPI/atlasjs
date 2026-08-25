---
id: GAMEPLAY-18
legacyId: C3
status: todo
domain: gameplay
source: "[[camera]]"
effort: M
verified: 2026-08-19
---

# `clearColor` / viewport rect / `renderTarget` par caméra

`Camera` (`packages/gameplay/src/components/Camera.ts`) n'a qu'un champ `zoom` : aucune donnée de rendu par caméra au-delà du zoom. Reste à étendre le composant avec `clearColor`, un viewport rect et une cible `renderTarget`.

**Bloqué par :** [[GAMEPLAY-16-multi-camera-render]] — ces champs par caméra n'ont de sens qu'une fois plusieurs caméras rendues simultanément.
