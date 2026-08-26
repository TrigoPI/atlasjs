---
id: GAMEPLAY-01
status: todo
domain: gameplay
source: "[[sprites]]"
effort: S
verified: 2026-08-19
---

# Blend mode et sampler configurables sur le sprite gameplay

`SpriteRender` n'a de champ ni pour le blend mode ni pour le sampler, et `SpriteRenderSystem` crée un unique `Sampler` `nearest` partagé, codé en dur, pour toutes les entités. Il reste à ajouter ces deux champs sur `SpriteRender`/`Sprite`, à les lire dans `SpriteRenderSystem`, et à les répercuter via les setters nebula déjà existants.

**Accroche :** `SpriteNode.blend`/`setBlend()` et `SpriteNode.sampler` (`packages/nebula/src/graphics/SpriteNode.ts:9,12,17,32-35`) exposent déjà la brique bas niveau ; il ne manque que le câblage côté `SpriteRenderSystem` (`packages/gameplay/src/systems/SpriteRenderSystem.ts:24,37-40,128`).
