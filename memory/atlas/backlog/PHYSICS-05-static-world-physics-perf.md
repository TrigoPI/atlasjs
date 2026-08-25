---
id: PHYSICS-05
status: todo
domain: physics
source: "[[collision-layer]]"
effort: M
verified: 2026-08-25
---

# Perf physique du monde statique (sync par intention + restriction ActiveCollisionTypes)

`PhysicsPushSystem` réécrit inconditionnellement masse/vélocités/transform de tout body à chaque frame, sans jamais consulter `isSleeping()` ni un dirty-flag — aucune passe de synchronisation « par intention » n'existe. Par ailleurs `mapColliderDesc` pose systématiquement `ActiveCollisionTypes.ALL`, qui active aussi les paires `FIXED_FIXED`, superflues pour une grande tilemap statique. Les deux relèvent de la même optimisation (réduire le travail fait sur un monde très statique) et se traitent ensemble.

Cause racine qui rend le problème **structurel et pas seulement gâché** : côté adapter, ces écritures passent `wake = true`. `packages/rapier/src/RapierRigidBody.ts:87` (`setTranslation`), `:101` (`setLinvel`), `:107` (`setRotation`), `:112` (`setAngvel`) et `:132` (`setAdditionalMass(value, true)`) réveillent tous le body. **Même en consultant `isSleeping()`, le sleeping resterait neutralisé** tant que les écritures réveillent : aucun body dynamic ne peut jamais dormir, puisque la passe de push le réveille à chaque frame, et le coût du solveur devient proportionnel au nombre *total* de bodies plutôt qu'aux bodies actifs. Deux gaspillages secondaires au même endroit : `setTranslation` et `setLinearVelocity` allouent chacun un `new RAPIER.Vector2` par appel (`RapierRigidBody.ts:79` et `:93`), et la branche vélocité s'exécute même pour les bodies `static` — `packages/gameplay/src/systems/PhysicsPushSystem.ts:76-78` est inconditionnel, seul le bloc transform de `:80-84` teste le type.

**Accroche :** `RigidBody.isSleeping()`/`.sleep()` existent déjà côté inertia/rapier ; `PhysicsPushSystem` ne les consulte simplement jamais avant de resynchroniser. Piste concrète : ne pousser que sur divergence, en comparant d'abord aux getters — `getLinearVelocity()`, `getAngularVelocity()`, `getMass()` remplissent un scratch interne et n'allouent pas, donc la comparaison est gratuite et le `wake = true` ne part que quand la valeur a réellement changé.
