---
id: PHYSICS-20
status: todo
domain: physics
effort: M
verified: 2026-08-25
---

# Auditer la fidélité du faux moteur physique à rapier

`packages/gameplay/test/helpers/fake-physics.ts` est le double sur lequel repose toute la couverture du pont physique. **Trois fois pendant le lot d'août 2026, un bug réel s'est révélé intestable tant que le double n'avait pas été corrigé** — le double était plus permissif que le backend, donc le test aurait été vert des deux côtés :

1. `3e7dcb2` — `destroyRigidBody` ne supprimait que le body, alors que rapier détruit **en cascade les colliders attachés**. C'est ce qui avait laissé passer le `PhysicsColliderRef` pendouillant, un bug qui coupait silencieusement les collisions d'une entité.
2. `b33950e` — `FakeCharacterController.computeMovement` ignorait complètement la position du collider, et `FakeCollider.getTranslation()` renvoyait la translation du **descripteur** (locale au body) là où `RapierCollider.getTranslation()` renvoie du **monde**.
3. `876165c` — `FakeCharacterController.computeMovement` retournait un `new Vec2` à chaque appel là où `RapierCharacterController` renvoie son **scratch réutilisé**, rendant le piège d'aliasing invisible par construction.

Le motif est clair : chaque écart de fidélité crée un **angle mort en forme de bug**, et on ne le découvre qu'en tombant sur le bug par un autre chemin. C'est le contraire de ce qu'un double doit apporter.

Ce qu'il faut : passer l'implémentation de `FakePhysicsWorld` / `FakeRigidBody` / `FakeCollider` / `FakeCharacterController` **méthode par méthode** contre `packages/rapier/src/`, et pour chacune se demander « sur quel point le double est-il plus indulgent ? ». Deux écarts déjà connus et non corrigés, à traiter en priorité parce qu'ils masquent des raisonnements que rien ne protège aujourd'hui :

- **Le recyclage de handles.** Le faux utilise des `Set` d'objets et des ids monotones (`nextId++`). Rapier indexe par **handle numérique recyclable par son arène**. C'est ce qui fonde l'ordre de retrait des refs dans `3e7dcb2` et `dbe53cb` — un ordre argumenté depuis la source de rapier, que **les deux ordres passent** dans le faux. Le jour où quelqu'un inverse ces deux lignes, rien ne le dira.
- **La propagation body → collider.** Le faux propage immédiatement ; rapier ne met à jour un collider attaché qu'à `World.step()` ou `propagateModifiedBodyPositionsToColliders()`. C'est précisément [[PHYSICS-19-propagate-body-positions-to-colliders]] : les tests de `character-controller-move-push.test.ts` sont verts alors que le backend réel ne l'est pas.

Piste complémentaire, si l'audit manuel paraît fragile : une petite suite de **tests de conformité** exécutée contre les deux implémentations de `PhysicsWorld` — le faux et rapier — pour les invariants qui ne dépendent pas d'un moteur graphique. C'est plus de travail au départ, mais c'est le seul dispositif qui empêche l'écart de réapparaître.

**Accroche :** commencer par les deux écarts listés ci-dessus, ils ont chacun un bug documenté derrière eux. `packages/gameplay/test/helpers/fake-physics.ts` face à `packages/rapier/src/RapierPhysicsWorld.ts`, `RapierRigidBody.ts`, `RapierCollider.ts`, `RapierCharacterController.ts`.

**À rapprocher de :** [[GAMEPLAY-84-test-suite-hygiene]] — même sujet vu sous l'angle de l'outillage de test.
