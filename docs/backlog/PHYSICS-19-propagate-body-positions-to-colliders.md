---
id: PHYSICS-19
status: todo
domain: physics
source: "[[character-controller]]"
effort: M
verified: 2026-08-25
---

# Le collider ne suit pas le body tant qu'aucun step physique n'a tourné

**Le personnage peut encore traverser un mur**, malgré le correctif `b33950e` (PHYSICS-14). Ce ticket est la moitié manquante.

`b33950e` fait pousser au `CharacterController.move()` la nouvelle position sur le body, pour que le collider suive dans la même frame. Côté rapier, ça ne suffit pas : `RigidBody.setTranslation()` **ne met pas à jour la position des colliders attachés** tant que `World.step()` ou `World.propagateModifiedBodyPositionsToColliders()` n'a pas tourné. La documentation rapier le dit (`pipeline/world.d.ts:74-80` : mise à jour « au début et à la fin de chaque `World.step` »), et un sondage direct sur le vrai backend le confirme — mur fixe à x=10, character cuboid, offset 0.01 :

```
collider avant move            : x = 0
move #1 autorisé               : x = 6
body après setTranslation      : x = 6
collider après setTranslation  : x = 0      ← n'a pas suivi
move #2 SANS propagation       : x = 6      ← le tunneling se reproduit
move #2 AVEC propagation       : x = 2.9899 ← comportement voulu
```

Or la condition qui déclenche le bug d'origine est précisément « **aucun step fixe sur cette frame** » (`advanceFixed` ne boucle que si `acc >= fixedDelta`, `packages/core/src/public/engine/Engine.ts:268-277`) — donc aucun `world.step()`, donc aucune propagation. Les deux moitiés du problème partagent exactement le même déclencheur, ce qui rend le correctif gameplay seul inopérant dans le cas qu'il visait.

Ce qui manque : une primitive sur `PhysicsWorld` (`packages/inertia`) du type `syncColliderPositions()`, déléguant à `propagateModifiedBodyPositionsToColliders` dans `packages/rapier/src/RapierPhysicsWorld.ts`, que `move()` appellerait après sa poussée. À trancher en écrivant : appel par `move()` (simple, mais N propagations si N contrôleurs bougent dans la frame) ou une seule propagation par frame posée dans une étape du scheduler entre `Logic` et `Late` (plus économe, mais réintroduit une dépendance d'ordonnancement — exactement ce que `CORE-08` cherche à réduire ailleurs).

À vérifier avant de choisir : le coût réel de `propagateModifiedBodyPositionsToColliders` sur un monde de la taille de `dino-brawl`. Rapier n'itère que les bodies marqués modifiés, donc l'appel devrait être proportionnel au nombre de contrôleurs ayant bougé, pas à la taille du monde — mais ça se mesure, ça ne se suppose pas.

Note sur la couverture : le faux moteur de `packages/gameplay/test/helpers/fake-physics.ts` a été rendu fidèle par `b33950e` sur le clamp et sur `getTranslation()`, mais **il propage immédiatement** — un collider y suit son body sans step. Les tests de `character-controller-move-push.test.ts` sont donc verts alors que le vrai backend ne l'est pas. C'est le principal angle mort restant du harnais physique, de la même famille que celui qui avait masqué PHYSICS-09.

**Accroche :** `packages/inertia/src/PhysicsWorld.ts` pour la primitive, `RapierPhysicsWorld` pour la délégation, puis `CharacterController.move()` (`packages/gameplay/src/scripting/components/CharacterController.ts`) juste après le `setTranslation` ajouté par `b33950e`.

**À rapprocher de :** [[PHYSICS-18-body-less-collider-never-repositioned]] et [[PHYSICS-17-inertia-set-body-type]] — même famille : une primitive absente d'`inertia` force gameplay à contourner.
