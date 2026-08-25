---
id: PHYSICS-12
status: todo
domain: physics
source: "[[gameplay-redesign]]"
effort: M
verified: 2026-08-25
---

# `RigidBody2D.type` est mutable côté script mais n'est jamais resynchronisé sur le body

`packages/inertia/src/RigidBody.ts:6` expose `readonly type` : il n'existe **aucun moyen de changer le type d'un body existant**, et `packages/gameplay/src/systems/PhysicsPushSystem.ts:73-85` ne pousse que `mass` et les vélocités — alors que `docs/gameplay/gameplay-redesign.md` §4 promet noir sur blanc un « sync `mass`/`type` ». Comme le token `RigidBody` est un passthrough (`src/scripting/components/index.ts:7-8`), un script *peut* écrire `rigidbody.type = "kinematic"` après la première frame : gameplay change alors instantanément de règle d'autorité (le pull cesse d'écrire, le push se met à téléporter) **pendant que le solveur garde un body dynamic** qui continue d'intégrer gravité et impulsions. Le tout sans aucun diagnostic.

À noter que la création est gardée par `.without(PhysicsBodyRef)` (`PhysicsPushSystem.ts:51`) et que `createRigidBody({type})` fige le type : les 9 tests de `packages/gameplay/test` qui touchent `.type` le font tous **avant** la première `frame()`, donc le cas n'est couvert nulle part. Le cœur du pont — dynamic → la physique fait autorité, kinematic et static → `Transform2D` fait autorité — fonctionne ; c'est la *transition* d'un type à l'autre qui n'a jamais été implémentée.

**Accroche :** dans la boucle de push (`PhysicsPushSystem.ts:73-85`), comparer `ref.body.type !== rigidBody.type` et, en cas de divergence, retirer `PhysicsBodyRef` **et** `PhysicsColliderRef` pour une recréation propre à la frame suivante — à défaut, lever explicitement plutôt que diverger en silence.
