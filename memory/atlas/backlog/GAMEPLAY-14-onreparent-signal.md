---
id: GAMEPLAY-14
legacyId: H6
status: todo
domain: gameplay
source: "[[entity-hierarchy]]"
effort: S
verified: 2026-08-19
---

# Signal éditeur `onReparent` dédié

`NexusWorld` n'expose que les signaux génériques `onAdd`/`onRemove` (`NexusWorld.ts:52,59`) ; combiner les deux suffit aujourd'hui à détecter un reparentage, mais un signal `onReparent` unique simplifierait un futur consommateur éditeur. Reste à l'ajouter.
