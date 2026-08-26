---
id: GAMEPLAY-09
legacyId: H1
status: todo
domain: gameplay
source: "[[entity-hierarchy]]"
effort: M
verified: 2026-08-19
---

# Passe physique de hiérarchie sans latence

`TransformPropagationSystem` n'est enregistré qu'en lane `update` (`GameplayPlugin.ts:290`), avant `PhysicsPushSystem` en lane `fixed` (`GameplayPlugin.ts:297`) : les bodies kinematic/static enfants lisent donc un `WorldTransform2D` vieux d'une frame. Il reste à ajouter une passe de propagation équivalente en `fixed`, avant le push physique.

**Accroche :** `TransformPropagationSystem` existe déjà en lane `update` — il s'agit de lui adjoindre un jumeau en `fixed`, pas de le réinventer.
