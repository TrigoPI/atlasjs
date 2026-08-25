---
id: RENDER-20
status: todo
domain: rendering
source: "[[trails]]"
effort: S
verified: 2026-08-23
---

# Table `BATCH_IDS` partagée entre renderers

`TrailNodeRenderer` et `ShapeRenderer` portent chacun une table `BATCH_IDS: Record<BlendMode, number>` **identique octet pour octet**. Deux sources de vérité pour la même chose : si l'une dérive, deux renderers cessent silencieusement de fusionner leurs batches.

**Accroche :** `KIND_ORDER` vit déjà dans `packages/nebula/src/renderers/NodeRenderer.ts` et joue exactement ce rôle de table partagée — un `BLEND_BATCH_IDS` à côté suffirait.
