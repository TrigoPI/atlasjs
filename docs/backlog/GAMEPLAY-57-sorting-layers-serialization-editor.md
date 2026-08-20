---
id: GAMEPLAY-57
status: vision
domain: gameplay
source: "[[sorting-layers]]"
effort: M
verified: 2026-08-20
---

# (Dé)sérialisation et éditeur des sorting layers

`SortingLayers.define()`/`indexOf()`/`modeOf()` ne se configure qu'en code au boot de l'app : ni sérialisation JSON, ni interface d'édition pour réordonner ou renommer les layers. Un éditeur dédié dépend d'une brique d'édition qui n'existe plus dans le repo (`packages/editor` a été retiré).
