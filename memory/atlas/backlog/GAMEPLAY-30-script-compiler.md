---
id: GAMEPLAY-30
legacyId: B2
status: vision
domain: gameplay
source: "[[scripting-components]]"
effort: L
verified: 2026-08-19
---

# Compilateur TypeScript de scripts (composants + variables exposées)

Aucun compilateur ni codegen n'existe dans `packages/gameplay/src` : les scripts écrivent aujourd'hui l'API à la main (`addComponent<T>(a, b)`, `registerScriptMetadata` déclaré séparément), exactement dans la forme que produirait le futur compilateur. Reste à construire ce compilateur custom : réécriture `addComponent<T>(...args)` → `addComponent(T, ...args)`, génération de `registerScriptMetadata`, et inline de la résolution token/factory en appels bruts (zéro dispatch runtime). Ce compilateur introduira aussi `@Expose()` comme pure syntaxe source, effacée à la compilation au profit d'un `registerScriptMetadata(...)` généré — ce n'est **pas** un retour au décorateur runtime (+ `Symbol.metadata` + Babel) abandonné au profit de `registerScriptMetadata`.

**Accroche :** la forme d'émission unique du token `defineScriptComponent` (Phase A/B1, déjà livrée) donne déjà la cible exacte que le compilateur devra produire.
