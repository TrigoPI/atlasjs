---
id: RENDER-11
status: todo
domain: rendering
source: "[[shapes]]"
effort: S
verified: 2026-08-19
---

# Anchor configurable par forme

`ShapeNode`/`Rect`/`Circle` n'exposent aucun champ `anchor` : l'origine des formes est câblée en dur au centre. Il reste à leur ajouter un champ `anchor` sur le modèle de celui déjà présent sur les sprites.

**Accroche :** `SpriteNode.anchor` (`packages/nebula/src/graphics/SpriteNode.ts`) donne déjà le mécanisme équivalent à répliquer sur les shapes.
