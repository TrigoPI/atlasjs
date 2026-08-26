---
id: GAMEPLAY-42
status: todo
domain: gameplay
source: "[[tilemap]]"
effort: L
verified: 2026-08-19
---

# (Dé)sérialisation JSON de tilemap + référence de tuile

Une tilemap ne peut être définie qu'en code : il n'existe ni format JSON de sauvegarde/chargement, ni schéma de référence de tuile (`tilesetId` + index) pour la relier à un asset stable. Ce chantier dépend du travail transverse `AssetRef` par id, pas encore entamé ailleurs dans le backlog.

**Accroche :** `TileSet.id` (`packages/gameplay/src/assets/TileSet.ts:19`) donne déjà un id stable à ancrer une future référence de tuile.
