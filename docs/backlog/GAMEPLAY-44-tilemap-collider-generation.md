---
id: GAMEPLAY-44
status: todo
domain: gameplay
source: "[[tilemap]]"
effort: M
verified: 2026-08-19
---

# Génération automatique de colliders depuis les cellules de tilemap

La solidité du monde livrée passe par des rects Tiled ingérés à la main côté application (`apps/dino-brawl/src/game/tiled/ingestColliders.ts`, calque `colliders`), pas par une génération automatique depuis les cellules pleines d'un `TileMap`. Le sujet reste donc entier : il manque un composant qui dérive les colliders directement d'un layer de cellules.

**Accroche :** sa dépendance d'origine est désormais résolue — `Collider2D` (le modèle de collision 2D côté gameplay) existe déjà, l'item n'est plus bloqué.
