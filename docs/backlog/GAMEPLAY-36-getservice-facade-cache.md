---
id: GAMEPLAY-36
status: todo
domain: gameplay
source: "[[exposed-script-variables]]"
effort: S
verified: 2026-08-19
---

# Cache de façade manquant sur `getService`

`RuntimeScriptContext.getService()` (`packages/gameplay/src/scripting/runtime/RuntimeScriptContext.ts:41-43`) fait `new type(this.services)` à chaque appel, sans aucun cache côté façade — seul le service backend est caché (`ServiceRegistry.get`), pas le wrapper. Reste à cacher la façade par (script, token), ou à corriger la documentation qui affirme ce cache comme existant.
