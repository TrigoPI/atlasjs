---
id: GAMEPLAY-32
status: vision
domain: gameplay
source: "[[exposed-script-variables]]"
effort: M
verified: 2026-08-19
---

# Métadonnées d'éditeur riches sur `ExposeFieldMetadata` (champs et refs d'entité)

`ExposeFieldMetadata` (`packages/gameplay/src/scripting/core/ScriptMetadata.ts:1-3`) ne porte que `{ type: "field" | "entity", required? }` : aucun `kind`, `assetKind`, `runtimeType`, tooltip, range, step, category, ni contrainte façon Unity `[RequireComponent]` sur les refs d'entité. Reste à étendre cette union discriminée avec ces métadonnées, générées par le futur compilateur.

**Bloqué par :** [[GAMEPLAY-30-script-compiler]] — ces métadonnées riches sont prévues comme une sortie du compilateur, pas comme une saisie manuelle.
