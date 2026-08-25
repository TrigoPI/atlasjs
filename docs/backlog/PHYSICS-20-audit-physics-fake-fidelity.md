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

Le compte est désormais de **quatre** occurrences, la quatrième étant celle réglée ci-dessous. Ce qu'il faut : passer l'implémentation de `FakePhysicsWorld` / `FakeRigidBody` / `FakeCollider` / `FakeCharacterController` **méthode par méthode** contre `packages/rapier/src/`, et pour chacune se demander « sur quel point le double est-il plus indulgent ? ». Deux écarts déjà connus et non corrigés, à traiter en priorité parce qu'ils masquent des raisonnements que rien ne protège aujourd'hui :

- **Le recyclage de handles.** Le faux utilise des `Set` d'objets et des ids monotones (`nextId++`). Rapier indexe par **handle numérique recyclable par son arène**. C'est ce qui fonde l'ordre de retrait des refs dans `3e7dcb2` et `dbe53cb` — un ordre argumenté depuis la source de rapier, que **les deux ordres passent** dans le faux. Le jour où quelqu'un inverse ces deux lignes, rien ne le dira.
- ~~**La propagation body → collider.**~~ **Réglé le 2026-08-25 par `edf4ffa`** — et c'est le meilleur exemple de ce que cette note décrit. Le faux propageait immédiatement ; rendu fidèle (instantané rafraîchi par `step()` ou par la nouvelle primitive `syncCollidersWithBodies`), **exactement deux tests sont tombés, et les deux étaient de vrais bugs** : le personnage traversait le mur de 20 unités. Le correctif de gameplay qui les visait (`b33950e`) était en place depuis plusieurs jours et se croyait vert.

Piste complémentaire, si l'audit manuel paraît fragile : une petite suite de **tests de conformité** exécutée contre les deux implémentations de `PhysicsWorld` — le faux et rapier — pour les invariants qui ne dépendent pas d'un moteur graphique. C'est plus de travail au départ, mais c'est le seul dispositif qui empêche l'écart de réapparaître.

**Cette piste a été essayée en miniature, et elle marche.** `edf4ffa` ajoute **deux tests exécutés contre le vrai rapier** (`packages/rapier/test/character-controller.test.ts`) plutôt que contre le double, et ils ont été validés comme de vrais garde-fous en neutralisant la primitive — les deux tombent. Là où un invariant ne dépend pas d'un contexte graphique, l'écrire côté `packages/rapier` supprime le problème à la racine au lieu de le déplacer. C'est le modèle à généraliser.

**Accroche :** commencer par le recyclage de handles, le seul des deux écarts listés qui reste ouvert — et celui dont dépend un raisonnement qu'aucun test ne protège. Puis balayer `packages/gameplay/test/helpers/fake-physics.ts` face à `packages/rapier/src/RapierPhysicsWorld.ts`, `RapierRigidBody.ts`, `RapierCollider.ts`, `RapierCharacterController.ts`.

**À rapprocher de :** [[GAMEPLAY-84-test-suite-hygiene]] — même sujet vu sous l'angle de l'outillage de test.
