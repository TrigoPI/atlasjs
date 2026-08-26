---
id: PHYSICS-18
status: todo
domain: physics
source: "[[gameplay-redesign]]"
effort: M
verified: 2026-08-25
---

# Un `Collider2D` sans `RigidBody2D` n'est jamais repositionné

`buildColliderDesc` (`packages/gameplay/src/systems/PhysicsPushSystem.ts`) ne lit `Transform2D` qu'à la **création** du collider. Une entité mobile qui porte un `Collider2D` **sans** `RigidBody2D` traîne donc son collider figé à son point de spawn : le sprite bouge, la zone de collision non. Aucun diagnostic.

Le commit `51cbf04` (PHYSICS-13) a ajouté une passe de synchronisation pour les six propriétés matérielles du collider, mais **pas la position** : `packages/inertia/src/Collider.ts` expose `getTranslation()` et `getRotation()` et **aucun setter correspondant**. Ce n'est donc pas une ligne à ajouter dans la passe existante — il faut élargir l'interface `Collider`, l'implémenter dans `RapierCollider` (avec la conversion d'unités via `PhysicsUnitConverter`, que le pont applique déjà aux translations) et compléter le faux moteur.

Deux points à trancher **avant** de coder, pas pendant :

1. **La fréquence d'écriture n'est pas celle des six autres propriétés.** La valeur à pousser est `resolvePlacement(...)` composé avec `col.offset`, donc elle change *à chaque frame* pour une entité qui bouge : une écriture par frame y est sémantiquement nécessaire, pas gratuite. La garde par divergence introduite par `51cbf04` reste utile, mais pour une autre raison — elle protégera les colliders **statiques sans body**, c'est-à-dire le décor ingéré par `apps/dino-brawl/src/game/tiled/ingestColliders.ts`, qui est le gros du volume.
2. **`Collider.setTranslation` de rapier a deux sémantiques.** Pour un collider sans parent il écrit une position **absolue** dans le monde ; pour un collider attaché à un body, la même méthode est **relative** au body. Une interface unique cacherait donc deux comportements différents derrière un seul nom — exactement la classe de piège que cet audit passe son temps à retirer. Soit deux méthodes nommées explicitement, soit une méthode réservée au cas sans body avec une garde bruyante.

**Accroche :** `packages/inertia/src/Collider.ts` — la décision d'API (point 2) est le seul vrai travail ; le reste est de la délégation et une extension du faux moteur.

**À rapprocher de :** `PHYSICS-17` (`inertia.setBodyType`), **livré** dans la PR #6 et donc sorti du backlog — même nature : une primitive manquante dans `inertia` forçait gameplay à contourner. Celle-ci ne l'est toujours pas.
