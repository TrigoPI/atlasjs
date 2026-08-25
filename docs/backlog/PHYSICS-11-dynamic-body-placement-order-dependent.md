---
id: PHYSICS-11
status: todo
domain: physics
source: "[[gameplay-redesign]]"
effort: S
verified: 2026-08-25
---

# Le placement d'un body dynamic parenté dépend de l'ordre d'apparition des composants

`packages/gameplay/src/systems/PhysicsPushSystem.ts:58` applique `resolvePlacement` à la création **quel que soit le type de body**. Or le modèle acté (`docs/gameplay/entity-hierarchy.md` §5.2 et §9, et `packages/gameplay/src/systems/TransformPropagationSystem.ts:59` où `isDynamic → world = local`) dit qu'un body dynamic n'est **pas composé** : son `Transform2D` *est* son monde. §5.3 du même doc réserve d'ailleurs explicitement ce placement à la « branche kinematic/static ».

Deux résultats possibles pour la même autorisation, selon que `WorldTransform2D` existe déjà ou non au moment de la création : soit le body est créé en coordonnées **locales** (cas normal — la lane `fixed` tourne avant `update` dans `Engine.startLoop`, et la propagation ne crée `WorldTransform2D` qu'en `update`/`Late`), soit en coordonnées **composées** (si `RigidBody2D` est ajouté une frame plus tard, ou pour un prefab instancié après une propagation), et le pull réécrit alors ce monde dans le `Transform2D` local → saut visuel et local corrompu. Aggravant : la re-poussée par frame est réservée à `kinematic`/`static` (`PhysicsPushSystem.ts:80-84`), donc **un dynamic mal placé ne se corrige jamais**. Le contrat d'autorité lui-même n'est pas en cause — il est verrouillé par `test/physics-bridge.test.ts` — c'est le placement initial qui est non déterministe.

**Accroche :** `PhysicsPushSystem.ts:58` — n'utiliser `resolvePlacement` que si `rigidBody.type !== "dynamic"`, sinon lire `transform.position`/`transform.rotation` bruts. Test de régression : un enfant dynamic spawné dans un parent décalé reste à son local.

**À rapprocher de :** [[GAMEPLAY-12-dynamic-body-transform-composition]] — sujet couplé mais distinct : celui-là veut *composer* un dynamic avec son parent, celui-ci corrige le non-déterminisme du placement tel que le modèle est aujourd'hui.
