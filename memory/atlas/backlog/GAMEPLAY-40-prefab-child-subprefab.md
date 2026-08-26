---
id: GAMEPLAY-40
status: todo
domain: gameplay
source: "[[prefab-multi-entity]]"
effort: S
verified: 2026-08-19
---

# `EntityBuilder.child(subPrefab, params)` composant un sous-prefab

`EntityBuilder.child` (`packages/gameplay/src/prefab/EntityBuilder.ts`) n'a qu'une signature, `child(build: (entity: EntityBuilder) => void): EntityBuilder` : aucune surcharge n'accepte un `Prefab<T>` réutilisable avec ses params. Reste à ajouter cette variante, en complément du callback inline déjà en place.

**Accroche :** `EntityBuilder.child()` existe déjà pour l'usage inline — il s'agit d'une surcharge additionnelle, pas d'une nouvelle primitive.
