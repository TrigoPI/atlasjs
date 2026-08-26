---
id: GAMEPLAY-55
status: todo
domain: gameplay
source: "[[occluder-ysort]]"
effort: M
verified: 2026-08-20
---

# Génération de colliders solides depuis les occluders

Le rectangle `occluder_regions` sert déjà de ligne de tri (`footY`) mais ne produit aucun `Collider2D` : ni le seam documenté par `occluder-ysort.md` §9, ni la réutilisation envisagée par `character-controller.md` pour la solidité du monde n'ont été câblés. Reste à poser, pour chaque rectangle (ou `OccluderStrip`), un `Collider2D` `layer = World` sur l'entité occluder ou une entité collider dédiée.

**Accroche :** `ingestColliders` (`apps/dino-brawl/src/game/tiled/ingestColliders.ts`) donne déjà le patron rect Tiled → `Collider2D` à réutiliser pour les rectangles `occluder_regions`.
