---
id: GAMEPLAY-70
status: todo
domain: gameplay
effort: S
verified: 2026-08-25
---

# `SortingLayers.indexOf` journalise à chaque frame et par entité sur un layer inconnu

`packages/gameplay/src/rendering/SortingLayers.ts:36-45` émet un `logger.warn` à chaque repli sur `Default`. Or son appelant `src/rendering/applySortFields.ts:16` est le chemin chaud **commun aux cinq systèmes de rendu** — `SpriteRenderSystem.ts:77`, `TileMapRenderSystem.ts:114`, `OccluderRenderSystem.ts:45`, `TrailRenderSystem.ts:63`, `AfterimageRenderSystem.ts:310` : une fois par sprite, par calque tilemap, par strip occluder, par trail, et **jusqu'à 64 fois par entité** pour les afterimages (`MAX_IMAGES = 64`, `AfterimageRenderSystem.ts:22`, la boucle balayant toute la capacité). Un simple nom de layer mal orthographié devient donc une inondation console + WebSocket à 60 Hz : `Logger.warn` ne déduplique pas (`packages/utils/src/logging/Logger.ts:18-22`), et le template littéral est construit avant l'appel donc alloué même en prod, où `createLogger` renvoie un `Logger([])` aux transports vides.

Le repli lui-même est bien testé (`test/sorting-layers.test.ts:36-39`, `test/apply-sort-fields.test.ts:32-39`) ; c'est le **coût du warning** qui n'est asserté nulle part, donc rien ne protège la correction d'une régression.

**Accroche :** `SortingLayers.ts:39-42`. Un `Set<string>` privé des noms déjà signalés, avertir à la première rencontre seulement — l'état vit déjà dans la classe à côté de `this.index`.
