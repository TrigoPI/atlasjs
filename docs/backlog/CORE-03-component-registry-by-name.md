---
id: CORE-03
status: vision
domain: core
source: "[[nexus-ecs]]"
effort: S
verified: 2026-08-19
---

# Registry de composants par nom

`ComponentRegistry.register` attribue aujourd'hui un id par ordre d'insertion, pas par nom : il n'existe aucun mécanisme donnant des ids de composant stables d'un process à l'autre (utile pour de la sérialisation ou du netcode). L'item est encore trop peu défini pour être détaillé davantage — il demande d'abord d'être cadré.
