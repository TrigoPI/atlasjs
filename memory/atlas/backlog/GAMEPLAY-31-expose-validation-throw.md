---
id: GAMEPLAY-31
status: vision
domain: gameplay
source: "[[exposed-script-variables]]"
effort: M
verified: 2026-08-19
---

# Validation stricte `TProps` ↔ metadata (throw + lien automatique)

`injectProps()` (`packages/gameplay/src/scripting/runtime/ScriptManager.ts`) se contente d'un `logger.warn` sur un champ requis manquant ou une clé non exposée — jamais de `throw` — et `AttachProps<P>`/`registerScriptMetadata` restent deux déclarations indépendantes sans lien type-level : un champ renommé d'un côté reste `undefined` silencieusement de l'autre. Reste à durcir en `throw` et à établir ce lien automatique.

**Bloqué par :** [[GAMEPLAY-30-script-compiler]] — le lien automatique `TProps` ↔ metadata doit être généré par le compilateur ; le warn minimal actuel n'est qu'une étape intermédiaire.
