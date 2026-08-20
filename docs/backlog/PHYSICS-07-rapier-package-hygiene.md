---
id: PHYSICS-07
status: todo
domain: physics
source: "[[collision-layer]]"
effort: S
verified: 2026-08-20
---

# Hygiène du package physique (dispose/free, dépendances inutilisées)

`RapierPhysicsWorld` n'expose que des `destroy*` par-objet (body/collider/controller) et aucun `dispose()`/équivalent `world.free()` pour un teardown complet du monde physique. Un nettoyage plus large (dépendances inutilisées, code mort) reste aussi à faire dans `@atlasjs/rapier`/`@atlasjs/inertia`, volontairement laissé de côté par le plan Phase 1 pour rester resserré sur les trois bugs de collision.
