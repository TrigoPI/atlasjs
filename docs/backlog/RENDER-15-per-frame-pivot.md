---
id: RENDER-15
status: todo
domain: rendering
source: "[[sorting-layers]]"
effort: S
verified: 2026-08-20
---

# Pivots distincts par frame dans une même sheet

`Frame` porte déjà un pivot individuel, mais `SpriteSheet.fromGrid`/`fromAutoGrid` ne stampent qu'un unique pivot uniforme sur toutes les frames d'une sheet. Autoriser un pivot différent par frame (ou par région) reste à ajouter au slicing.

**Accroche :** `Frame.pivot` (`packages/nebula/src/animations/Frame.ts`) porte déjà la donnée par-frame ; il manque un chemin d'authoring qui la fasse varier au sein d'une même sheet.
