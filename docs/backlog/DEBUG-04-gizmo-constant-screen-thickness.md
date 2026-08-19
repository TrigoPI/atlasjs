---
id: DEBUG-04
status: todo
domain: debug
source: "[[gizmos]]"
effort: S
verified: 2026-08-19
---

# Épaisseur de contour constante à l'écran

`ShapeNode.setBorderWidth` stocke la largeur en unités monde : le contour d'un gizmo s'épaissit visuellement au dézoom au lieu de garder une épaisseur constante en pixels. Il faudrait faire entrer le facteur de zoom caméra dans le shader.

**Accroche :** `ShapeNode.ts:27-30` (`packages/nebula/src/graphics/ShapeNode.ts`) est le point d'entrée exact du stockage à corriger.
