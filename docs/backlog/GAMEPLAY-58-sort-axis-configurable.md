---
id: GAMEPLAY-58
status: vision
domain: gameplay
source: "[[sorting-layers]]"
effort: M
verified: 2026-08-20
---

# Axe de tri configurable (vecteur custom ou par caméra)

`SpriteRenderSystem`/`TileMapRenderSystem` posent `sortPrimary = worldTransform.getPosition().y` en mode `ySorted` : l'axe Y-down est câblé en dur, `SortingLayers` n'expose aucun moyen de choisir un autre axe ou de le faire dépendre de la caméra active. Utile pour une vue isométrique ou une future extension 3D, hors périmètre du top-down actuel.
