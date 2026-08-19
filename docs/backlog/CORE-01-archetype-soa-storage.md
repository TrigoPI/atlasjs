---
id: CORE-01
status: todo
domain: core
source: "[[nexus-ecs]]"
effort: L
verified: 2026-08-19
---

# Backend de stockage par archétypes (SoA)

`SparseSetStore` est aujourd'hui la seule implémentation de `IComponentStore` : il reste à écrire un backend archétype/SoA alternatif pour les cas où l'itération séquentielle sur de grosses populations prime sur l'add/remove aléatoire.

**Accroche :** `IComponentStore` est déjà pensé comme une interface swappable — le nouveau backend peut se brancher sans toucher aux query APIs.
