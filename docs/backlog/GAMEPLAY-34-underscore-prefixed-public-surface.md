---
id: GAMEPLAY-34
status: todo
domain: gameplay
source: "[[exposed-script-variables]]"
effort: S
verified: 2026-08-19
---

# Surface `__`-préfixée publique sur `AtlasScript`

`__props`, `__bindContext()` et `__unbindContext()` (`packages/gameplay/src/scripting/core/AtlasScript.ts:16-33`) restent `public` alors qu'ils ne servent qu'au runtime (`__context`, lui, est déjà `private`) — ils polluent l'autocomplétion de l'auteur de script. Reste à les masquer, par des clés `Symbol` ou un `ScriptRuntimeHandle` séparé manipulé par `ScriptManager`, en ne laissant sur `AtlasScript` que le cycle de vie et l'accès composants/services.
