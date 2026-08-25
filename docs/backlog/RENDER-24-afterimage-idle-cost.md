---
id: RENDER-24
status: todo
domain: rendering
source: "[[afterimages]]"
effort: S
verified: 2026-08-24
---

# Coût au repos et par frame d'`AfterimageRenderSystem`

Deux écarts au coût que [`afterimages.md`](../rendering/afterimages.md) §6 annonce, tous deux relevés en revue et **raisonnés sans être mesurés** :

1. **Le parcours de dessin balaie toute la capacité, pas les images vivantes.** Un émetteur au repos (`emitting: false`, zéro image) avec `maxImages: 64` paie 64 itérations et jusqu'à 64 `setVisible(false)` par frame, indéfiniment. Le doc écrit pourtant qu'un tel émetteur « fait un parcours de requête et rien d'autre ». Invisible aux réglages du dash (8 images), c'est le passage à l'échelle qui le rend faux.
2. **`setAnchor` et `setSourceRect` sont réappliqués chaque frame** sur un instantané dont le `Sprite` ne change jamais après l'estampe — et `SpriteNode.setAnchor` fait un contrôle de bornes avec `throw` à chaque appel. `SpriteRenderSystem.resolveNode`, lui, ne les applique que quand la référence de sprite change.

**Accroche :** les deux se règlent sans toucher au design — hisser l'ancre et la source rect dans le montage/l'estampe, et borner le parcours de dessin aux emplacements vivants (le ring connaît déjà `count` et `head`). À ne faire que si un profil le justifie : ne pas optimiser à l'aveugle un chemin dont le coût réel n'a jamais été chiffré.
