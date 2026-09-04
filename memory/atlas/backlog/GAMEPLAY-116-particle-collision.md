---
id: GAMEPLAY-116
status: vision
domain: gameplay
source: "[[particles]]"
effort: L
verified: 2026-09-04
---

# Collision des particules avec le monde

Des particules qui rebondissent sur le monde ou y meurent — étincelles qui ricochent sur le sol, pluie qui s'arrête sur une plateforme. Demande d'abord une décision sur le **budget de requêtes** : une requête de broadphase par particule par frame n'est pas payable à quelques milliers de particules.

**Accroche :** `PhysicsQuery` est livré et expose `intersectPoint`, `intersectAABB` et `raycast` (`packages/inertia/src/PhysicsQuery.ts`), avec une implémentation rapier (`packages/rapier/src/RapierPhyicsQuery.ts`) ; les positions des particules sont de simples données CPU dans les tableaux SoA de `CPUParticleNode` (`getX`/`getY`/`getVelocityX`/`getVelocityY`, `packages/nebula/src/graphics/CPUParticleNode.ts:413-427`). La pièce manquante est un test spatial peu coûteux, pas l'accès aux données.

**Attention à ce qui n'existe pas.** Il n'y a **pas** de couche de collision tilemap côté moteur : `TileMap`/`TileMapRenderer` (`packages/gameplay/src/components/`) ne portent aucune notion de tuile solide, et `CollisionLayers` (`packages/inertia/src/CollisionLayers.ts`) est un système de **masques de filtrage**, pas une grille de collision. La seule voie tilemap → colliders vit au niveau applicatif, dans l'ingest Tiled de dino-brawl (`apps/dino-brawl/src/game/tiled/ingestColliders.ts`), qui produit des entités `Collider2D`. Une collision de particules contre une grille demanderait donc soit de passer par ces colliders, soit d'introduire la grille solide qui manque.
