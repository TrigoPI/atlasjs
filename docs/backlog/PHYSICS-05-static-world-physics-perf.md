---
id: PHYSICS-05
status: todo
domain: physics
source: "[[collision-layer]]"
effort: M
verified: 2026-08-20
---

# Perf physique du monde statique (sync par intention + restriction ActiveCollisionTypes)

`PhysicsPushSystem` réécrit inconditionnellement masse/vélocités/transform de tout body à chaque frame, sans jamais consulter `isSleeping()` ni un dirty-flag — aucune passe de synchronisation « par intention » n'existe. Par ailleurs `mapColliderDesc` pose systématiquement `ActiveCollisionTypes.ALL`, qui active aussi les paires `FIXED_FIXED`, superflues pour une grande tilemap statique. Les deux relèvent de la même optimisation (réduire le travail fait sur un monde très statique) et se traitent ensemble.

**Accroche :** `RigidBody.isSleeping()`/`.sleep()` existent déjà côté inertia/rapier ; `PhysicsPushSystem` ne les consulte simplement jamais avant de resynchroniser.
