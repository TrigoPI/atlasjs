---
id: GAMEPLAY-13
legacyId: H5
status: todo
domain: gameplay
source: "[[entity-hierarchy]]"
effort: S
verified: 2026-08-19
---

# Destruction orpheline (option de reparentage à la racine)

`NexusWorld.destroyEntity()` (`packages/nexus/src/world/NexusWorld.ts:116-141`) détruit toujours récursivement tous les descendants, sans paramètre pour reparenter les enfants à la racine à la place. Il reste à ajouter cette option comme alternative à la cascade par défaut.
