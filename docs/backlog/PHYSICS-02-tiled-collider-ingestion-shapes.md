---
id: PHYSICS-02
status: todo
domain: physics
source: "[[character-controller]]"
effort: M
verified: 2026-08-20
---

# Ingestion Tiled enrichie : colliders non-rectangulaires et multi-collider par entité

`ingestColliders` ne reconnaît que des `RectObject` et pose un unique `Collider2D` de type `box` par entité créée ; les polygones/ellipses Tiled ne sont pas convertis, et une entité ne peut porter qu'une seule forme de collision. Les deux limites viennent du même pipeline d'ingestion et se règlent ensemble : formes non-rectangulaires côté parsing Tiled, puis plusieurs `Collider2D` par entité côté `PhysicsPushSystem`.

**Accroche :** `colliderFromRect`/`isColliderObject` (`apps/dino-brawl/src/game/tiled/ingestColliders.ts`) donnent déjà le patron d'ingestion rect→collider à généraliser.
