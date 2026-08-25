---
id: DEBUG-02
status: todo
domain: debug
source: "[[gizmos]]"
effort: M
verified: 2026-08-19
---

# `Gizmos.drawLine` + pool de `LineNode`

Le service `Gizmos` n'expose que `drawRect`/`drawCircle` : aucune primitive ligne n'existe. Cela bloque d'un coup les gizmos de raycast, les vecteurs (direction, vitesse, normales de contact) et les lignes de hiérarchie parent → enfant.

**Accroche :** `Gizmos.ts` (`packages/gizmos/src/Gizmos.ts`) donne déjà le patron `drawRect`/`drawCircle` à répliquer pour `drawLine`, sur un pool de `LineNode` recyclés comme les nœuds existants.
