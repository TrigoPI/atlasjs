---
id: GAMEPLAY-59
status: todo
domain: gameplay
source: "[[sort-point-anchor]]"
effort: M
verified: 2026-08-20
---

# Personnalisation du point de tri (pivot par-instance, offset d'empilement, ancrage hiérarchique)

`SpriteRender.sortPointEntity` permet déjà de trier un accessoire au Y de son porteur, mais trois extensions restent ouvertes : un override de pivot par-instance sur `SpriteRender` (aujourd'hui le pivot ne vit que sur l'asset `Sprite`, partagé par toutes ses instances) ; un petit offset de tri à côté de `sortPointEntity` pour empiler plusieurs accessoires entre eux sans dépendre uniquement de `sortingOrder` ; et une dérivation automatique du sort point depuis le parent `Parent`/`Children`, pour éviter de poser `sortPointEntity` à la main quand l'accessoire est déjà un enfant.

**Accroche :** `SpriteRender.sortPointEntity` et sa résolution dans `SpriteRenderSystem.update` (`packages/gameplay/src/systems/SpriteRenderSystem.ts`) donnent déjà le mécanisme à étendre.
