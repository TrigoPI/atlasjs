---
id: PHYSICS-04
status: todo
domain: physics
source: "[[character-controller]]"
effort: S
verified: 2026-08-20
---

# Dépénétration des overlaps au spawn

Aucun mécanisme ne corrige un chevauchement initial entre le collider d'une entité et le décor au moment de sa création (spawn dans un mur, colliders Tiled mal placés qui se recouvrent) : le character controller ne résout que les déplacements demandés après coup, jamais l'état de départ. Reste à ajouter une passe de dépénétration lors de la création du collider/controller.
