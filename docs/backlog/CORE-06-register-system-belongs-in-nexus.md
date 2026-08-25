---
id: CORE-06
status: todo
domain: core
effort: S
verified: 2026-08-25
---

# `registerSystem` vit dans gameplay alors qu'il n'a aucun contenu gameplay

`packages/gameplay/src/registerSystem.ts` (11 LOC) est l'adaptateur `NexusSystem` → étape de scheduler : il enveloppe `system.update({ world, dt })` dans un `lane.add(...)`. Ses deux seuls imports (lignes 1-2) sont `@atlasjs/core` et `@atlasjs/nexus` — **zéro contenu gameplay**, il est là par accident historique. Le coût est déjà visible : `packages/gizmos/src/GizmoPlugin.ts:5` importe `registerSystem` **depuis `@atlasjs/gameplay`**, ce qui met un paquet de debug en aval de l'audio, des prefabs et du scripting pour une fonction de onze lignes.

**Accroche :** déplacer le fichier dans `@atlasjs/nexus` et corriger l'import de gizmos (1 ligne) ; `packages/gameplay/src/index.ts:13` fait déjà un `export * from "./registerSystem"`, qu'un ré-export peut conserver pour la compatibilité. Valeur faible mais coût quasi nul — à faire en passant si on touche déjà `nexus`.
