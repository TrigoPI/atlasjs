---
id: RENDER-24
status: todo
domain: rendering
source: "[[afterimages]]"
effort: S
verified: 2026-08-25
---

# Coût au repos et par frame d'`AfterimageRenderSystem`

Trois écarts au coût que [`afterimages.md`](../rendering/afterimages.md) §6 annonce, tous relevés en revue et **raisonnés sans être mesurés** :

1. **Le parcours de dessin balaie toute la capacité, pas les images vivantes.** Un émetteur au repos (`emitting: false`, zéro image) avec `maxImages: 64` paie 64 itérations et jusqu'à 64 `setVisible(false)` par frame, indéfiniment. Le doc écrit pourtant qu'un tel émetteur « fait un parcours de requête et rien d'autre ». Invisible aux réglages du dash (8 images), c'est le passage à l'échelle qui le rend faux.
2. **`setAnchor` et `setSourceRect` sont réappliqués chaque frame** sur un instantané dont le `Sprite` ne change jamais après l'estampe — et `SpriteNode.setAnchor` fait un contrôle de bornes avec `throw` à chaque appel. `SpriteRenderSystem.resolveNode`, lui, ne les applique que quand la référence de sprite change.
3. **La résolution du sorting layer est refaite par image.** `packages/gameplay/src/systems/AfterimageRenderSystem.ts:310-316` appelle `applySortFields` **dans** la boucle sur les emplacements, donc `sortingLayers.indexOf(mounted.sortingLayer)` (un `Map.get` plus un `warn` si le nom est inconnu) et `modeOf` sont refaits jusqu'à 64 fois par entité et par frame, alors que `mounted.sortingLayer` est constant sur toute la boucle — seul `slot.y` change d'un emplacement à l'autre. Correctif : résoudre `layerIndex` et `mode` une fois avant la boucle ; une surcharge `applySortFieldsResolved(target, layerIndex, mode, order, y)` servirait aussi les autres systèmes de rendu, qui appellent tous le même helper.

**Accroche :** les trois se règlent sans toucher au design — hisser l'ancre et la source rect dans le montage/l'estampe, hisser la résolution de couche hors de la boucle, et borner le parcours de dessin aux emplacements vivants (le ring connaît déjà `count` et `head`). À ne faire que si un profil le justifie : ne pas optimiser à l'aveugle un chemin dont le coût réel n'a jamais été chiffré.
