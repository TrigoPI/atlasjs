---
id: DEBUG-07
status: todo
domain: debug
source: "[[gizmos]]"
effort: S
verified: 2026-08-19
---

# Surcharge `Collider.getTranslation(out?: Vec2)`

`RapierCollider.getTranslation()` alloue un `Vec2` neuf à chaque appel, soit deux allocations par collider et par frame dès que les gizmos de debug sont actifs. Ajouter une surcharge `getTranslation(out?: Vec2)` à l'interface `Collider` de `@atlasjs/inertia` éviterait l'allocation côté appelant.

**Accroche :** `Collider.ts:27` (`packages/inertia/src/Collider.ts`) et `RapierCollider.ts:104-107` (`packages/rapier/src/RapierCollider.ts`) localisent l'interface et l'implémentation à faire évoluer ensemble.
