---
id: PHYSICS-17
status: todo
domain: physics
source: "[[gameplay-redesign]]"
effort: M
verified: 2026-08-25
---

# `setBodyType` sur l'interface `RigidBody` d'inertia

`packages/inertia/src/RigidBody.ts:6` déclare `readonly type` : il n'existe aucun moyen de changer le type d'un body existant. Faute de cette primitive, le commit `dbe53cb` (PHYSICS-12) fait honorer un changement de `RigidBody2D.type` en **détruisant et recréant** body et collider. Ça supprime la divergence silencieuse — c'était l'urgence — mais c'est structurellement inférieur, sur trois points concrets :

1. **La recréation perd l'état que le composant ne porte pas.** `createRigidBody` ne reçoit que type, translation, rotation et vélocités. Tout ce qui vit sur le body sans miroir dans `RigidBody2D` disparaît : `gravityScale`, `linearDamping`/`angularDamping`, `enabled`, `userData`, l'état de sommeil. Un script qui a posé `setGravityScale(0)` puis bascule le type le perd **sans le savoir** — on a remplacé un bug silencieux par une perte silencieuse, plus petite mais de même nature. Et ce n'est pas testable tant que ces propriétés n'ont pas de miroir ECS.
2. **Le collider est détruit et recréé pour rien.** Il ne dépend pas du type du body ; on paie sa destruction uniquement parce que la cascade rapier (`RapierPhysicsWorld.destroyRigidBody`) ne laisse pas le choix. Sur une entité à colliders multiples ou lourds, c'est du gaspillage pur.
3. **L'identité du body change.** Tout `Collider.getRigidBody()`, tout `userData`, toute référence capturée pointe sur un objet mort. C'est contenu aujourd'hui parce que gameplay ne stocke le body que dans `PhysicsBodyRef`, mais c'est un piège pour quiconque en cachera une référence.

Rapier expose la primitive nativement : `RAPIER.RigidBody.setBodyType(status, wakeUp)`. `RapierRigidBody` n'aurait donc qu'à déléguer. Le body garde son handle, ses colliders, son damping et son gravity scale.

La seule vraie décision d'API est de faire passer `type` de `readonly` à un champ privé plus un getter, sur l'interface `RigidBody` comme sur `RapierRigidBody` (`packages/rapier/src/RapierRigidBody.ts:11`) et sur `FakeRigidBody` (`packages/gameplay/test/helpers/fake-physics.ts`, où il vient d'être resserré en `readonly` pour coller à rapier).

Une fois la primitive disponible, le bloc `pendingRebuild` de `PhysicsPushSystem` (détection en tête d'`update()`, retrait ordonné des deux refs, reconstruction) se réduit à une ligne dans la boucle de push existante : `if (ref.body.type !== rigidBody.type) ref.body.setBodyType(rigidBody.type);`. Disparaissent avec lui la question de l'ordre de destruction et celle du recyclage de handles rapier — un raisonnement qu'aucun test ne protège aujourd'hui, le faux moteur n'ayant ni handles numériques ni recyclage.

Point d'entretien à traiter en même temps : `docs/gameplay/gameplay-redesign.md` §4 promet un « sync `mass`/`type` ». Le `type` est désormais honoré, mais par recréation et non par synchronisation — la formulation ne redeviendra exacte qu'avec ce ticket.

**Accroche :** `packages/inertia/src/RigidBody.ts:6` — le passage de `readonly type` à getter est le seul point qui touche le contrat public ; le reste est de la délégation.

**À rapprocher de :** [[PHYSICS-13-collider-props-frozen-at-creation]] — même famille : des propriétés runtime sans miroir ECS, donc invisibles et non resynchronisables.
