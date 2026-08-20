---
id: GAMEPLAY-56
status: vision
domain: gameplay
source: "[[sorting-layers]]"
effort: M
verified: 2026-08-20
---

# Tri par bandes pour les sprites occultants profonds

Un `SpriteRender` occultant plus profond en Y qu'une simple ligne de pieds (un grand bâtiment) ne peut pas se scinder en bandes triées séparément contre le joueur — seuls le split manuel de l'asset en plusieurs sprites ou le layer `Overhead` contournent le problème aujourd'hui. Un mécanisme dédié (dans l'esprit d'`OccluderStrip`, mais pour un sprite unique plutôt qu'un calque de tuiles peint) reste à concevoir.
