---
id: GAMEPLAY-61
status: todo
domain: gameplay
source: "[[trails]]"
effort: M
verified: 2026-08-25
---

# Cycle de vie mount/unmount cohérent pour les quatre systèmes de rendu

`SpriteRenderSystem`, `TileMapRenderSystem`, `OccluderRenderSystem` et `TrailRenderSystem` montent chacun des nœuds dans la scène nebula, mais leur nettoyage diverge : seul `TrailRenderSystem` a un `clear()`, et il ne balaie que ses trails détachés — pas ses montures vivantes. Un trail encore vivant à l'`uninstall()` du plugin laisse donc son nœud dans la scène sans aucun chemin pour l'en retirer, et les trois autres systèmes ne nettoient rien du tout.

Deuxième volet du même sujet : `TrailRenderSystem.detach` est public et sans garde. Appelé hors du hook `onRemove` alors que le composant existe encore, le prochain `update()` remonte un nouveau nœud pour la même entité — deux rubans simultanés. Le contrat mérite d'être verrouillé ou documenté.

Troisième volet : **un nœud devient orphelin quand `Transform2D` est retiré sans que le composant de rendu le soit.** `GameplayPlugin.ts:250-254` — le hook `onRemove(Transform2D)` retire `WorldTransform2D`, ce qui sort l'entité de la query `query(WorldTransform2D, SpriteRender)`, mais **aucun `onRemove(WorldTransform2D)` n'appelle `unmount`** : les démontages sont tous branchés sur le composant de rendu (`SpriteRender`, `TileMap`, `OccluderStrip`, `TrailRenderer`, `AfterimageRenderer`), jamais sur la transformation. Le `SpriteNode` reste donc enfant de `nebula.scene`, visible, figé sur sa dernière transformation, sans plus aucun chemin pour le retirer. Même raisonnement pour `TileMapRenderSystem`, `OccluderRenderSystem` et les deux systèmes à pool de nœuds (`TrailRenderSystem`, `AfterimageRenderSystem`), dont les queries exigent toutes `WorldTransform2D`. Le chemin nominal — destruction d'entité complète — n'est pas affecté. Le correctif rejoint le contrat commun décrit plus haut : brancher les démontages sur `onRemove(WorldTransform2D)`, qui est le composant que les queries de rendu exigent réellement. Ce volet est **déduit statiquement des hooks** et mériterait une vérification navigateur.

**Accroche :** `GameplayPlugin.uninstall()` centralise déjà la démolition (`handles`, `unsubscribers`, `scriptManager.dispose()`) et appelle `trailRenderSystem.clear()` — c'est le point où un contrat commun se brancherait.
