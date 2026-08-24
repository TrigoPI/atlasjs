---
id: GAMEPLAY-61
status: todo
domain: gameplay
source: "[[trails]]"
effort: M
verified: 2026-08-23
---

# Cycle de vie mount/unmount cohérent pour les quatre systèmes de rendu

`SpriteRenderSystem`, `TileMapRenderSystem`, `OccluderRenderSystem` et `TrailRenderSystem` montent chacun des nœuds dans la scène nebula, mais leur nettoyage diverge : seul `TrailRenderSystem` a un `clear()`, et il ne balaie que ses trails détachés — pas ses montures vivantes. Un trail encore vivant à l'`uninstall()` du plugin laisse donc son nœud dans la scène sans aucun chemin pour l'en retirer, et les trois autres systèmes ne nettoient rien du tout.

Deuxième volet du même sujet : `TrailRenderSystem.detach` est public et sans garde. Appelé hors du hook `onRemove` alors que le composant existe encore, le prochain `update()` remonte un nouveau nœud pour la même entité — deux rubans simultanés. Le contrat mérite d'être verrouillé ou documenté.

**Accroche :** `GameplayPlugin.uninstall()` centralise déjà la démolition (`handles`, `unsubscribers`, `scriptManager.dispose()`) et appelle `trailRenderSystem.clear()` — c'est le point où un contrat commun se brancherait.
